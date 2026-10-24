// @vitest-environment node
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { criarResolvedorImagens } from '../images.ts'
import { validarManifesto } from '../manifest.ts'
import { planejar } from '../plan.ts'
import type { ManifestoArtigo } from '../types.ts'
import {
  ajustarCorpo,
  converterKb,
  lerFrontMatter,
  normalizarUrl,
} from './smartshare-kb.ts'

const KB = path.resolve(import.meta.dirname, 'fixture-smartshare-kb/kb')

describe('lerFrontMatter', () => {
  it('lê chaves simples e strings entre aspas', () => {
    const { meta, corpo } = lerFrontMatter(
      '---\ntitulo: "Anexos \\\\ x"\nid: 7\nurl: https://a.b/c/\n---\n\n# T\n\ntexto',
    )
    expect(meta).toEqual({
      titulo: 'Anexos \\ x',
      id: '7',
      url: 'https://a.b/c/',
    })
    expect(corpo.trim()).toBe('# T\n\ntexto')
  })
})

describe('normalizarUrl', () => {
  it('ignora barra final, hash, query e caixa do host', () => {
    expect(
      normalizarUrl('https://Docs.Selbetti.com.br/knowledge-base/x/?a=1#b'),
    ).toBe('https://docs.selbetti.com.br/knowledge-base/x')
  })
})

describe('ajustarCorpo', () => {
  const ids = new Map([['https://docs.selbetti.com.br/knowledge-base/x', '9']])
  it('remove o H1 do título, rebaixa H4+ e limpa o alt das imagens', () => {
    const r = ajustarCorpo(
      '# Título\n\nTexto\n\n#### Sub\n\n![IMG: Tela](http://a/b.png)',
      'Título',
      ids,
    )
    expect(r).toBe('Texto\n\n### Sub\n\n![Tela](http://a/b.png)\n')
  })
  it('mantém um H1 diferente do título', () => {
    expect(ajustarCorpo('# Outro\n\nx', 'Título', ids)).toContain('# Outro')
  })
  it('troca links do site antigo por artigo:<id>, sem tocar em imagens nem externos', () => {
    const r = ajustarCorpo(
      '[a](https://docs.selbetti.com.br/knowledge-base/x/) ![i](https://docs.selbetti.com.br/knowledge-base/x/) [b](https://example.com)',
      'T',
      ids,
    )
    expect(r).toContain('[a](artigo:9)')
    expect(r).toContain('![i](https://docs.selbetti.com.br/knowledge-base/x/)')
    expect(r).toContain('[b](https://example.com)')
  })
})

describe('converterKb (fixture no formato do extrair_kb.py)', () => {
  it('monta a hierarquia a partir das pastas e dos _index.md', async () => {
    const { manifesto } = await converterKb(KB)
    const porId = new Map(manifesto.blocos.map((b) => [b.id, b]))
    expect(porId.get('smartshare')).toMatchObject({ nome: 'SmartShare' })
    expect(porId.get('smartshare')?.pai).toBeUndefined()
    expect(porId.get('smartshare-4')).toMatchObject({ nome: 'SmartShare 4' })
    expect(
      porId.get('smartshare/smartshare-administrador-ecm-bpm'),
    ).toMatchObject({
      nome: 'SmartShare Administrador ECM/BPM',
      pai: 'smartshare',
    })
    expect(
      porId.get(
        'smartshare/smartshare-administrador-ecm-bpm/gerenciamento-de-atividades',
      )?.pai,
    ).toBe('smartshare/smartshare-administrador-ecm-bpm')
  })

  it('usa o id do WordPress, a data do site e trata descontinuados como rascunho', async () => {
    const { manifesto } = await converterKb(KB)
    const porId = new Map(manifesto.artigos.map((a) => [a.id, a]))
    expect(porId.get('101')).toMatchObject({
      titulo: 'Anexos em atividades',
      bloco: 'smartshare/smartshare-administrador-ecm-bpm',
      publicado: true,
      atualizadoEm: '2024-05-10T12:00:00',
      publico: 'usuario',
    })
    expect(porId.get('103')?.publicado).toBe(false)
    const com = await converterKb(KB, { publicarDescontinuados: true })
    expect(com.manifesto.artigos.find((a) => a.id === '103')?.publicado).toBe(
      true,
    )
  })

  it('classifica como técnico pela regex da categoria', async () => {
    const { manifesto } = await converterKb(KB, {
      tecnico: /Gerenciamento de Atividades/i,
    })
    expect(manifesto.artigos.find((a) => a.id === '102')?.publico).toBe(
      'tecnico',
    )
    expect(manifesto.artigos.find((a) => a.id === '101')?.publico).toBe(
      'usuario',
    )
  })

  it('reescreve links entre artigos e gera um manifesto válido', async () => {
    const { manifesto, arquivos } = await converterKb(KB)
    expect(arquivos.get('artigos/101.md')).toContain('(artigo:102)')
    expect(arquivos.get('artigos/201.md')).toContain('(artigo:101)')
    expect(arquivos.get('artigos/101.md')).not.toMatch(/^# Anexos/m)
    expect('manifesto' in validarManifesto(manifesto)).toBe(true)
  })

  it('o importador consome a saída: links resolvidos, falhas de imagem relatadas', async () => {
    const { manifesto, arquivos } = await converterKb(KB)
    const saida = await mkdtemp(path.join(os.tmpdir(), 'kb-'))
    await mkdir(path.join(saida, 'artigos'))
    for (const [rel, conteudo] of arquivos)
      await writeFile(path.join(saida, rel), conteudo)

    const plano = await planejar(manifesto, {
      agora: 1,
      autorId: 'migracao',
      lerConteudo: (a: ManifestoArtigo) =>
        readFile(path.join(saida, a.arquivo ?? ''), 'utf8'),
      // Sem rede: toda imagem remota "falha"; a embutida também.
      resolverImagem: criarResolvedorImagens({
        baseDir: saida,
        cloudinary: null,
        cache: new Map(),
      }),
    })
    expect(plano.artigos).toHaveLength(4)
    expect(plano.relatorio.artigosSemBloco).toEqual([])
    const anexos = plano.artigos.find(
      (a) => a.titulo === 'Anexos em atividades',
    )
    const gerenc = plano.artigos.find(
      (a) => a.titulo === 'Gerenciamento de Atividades',
    )
    expect(JSON.stringify(anexos?.conteudo)).toContain(`/a/${gerenc?.id}`)
    expect(plano.relatorio.linksQuebrados).toEqual([])
    expect(
      plano.artigos.find((a) => a.titulo === 'Módulo antigo')?.status,
    ).toBe('draft')
    // H4 virou H3 e a tabela do gerenciamento virou texto, com aviso.
    expect(JSON.stringify(anexos?.conteudo)).toContain('"level":3')
    expect(plano.relatorio.imagensComFalha.map((i) => i.src)).toContain(
      'imagem-embutida-no-site',
    )
  })
})
