// @vitest-environment node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { criarResolvedorImagens, detectarTipo } from './images.ts'
import { validarManifesto } from './manifest.ts'
import { criarGeradorDeIds, planejar } from './plan.ts'
import { relatorioEmMarkdown, temPendencias } from './report.ts'
import type { ManifestoArtigo } from './types.ts'

const EXEMPLO = path.resolve(import.meta.dirname, 'exemplo')

async function planoDoExemplo(
  verificarLink?: (h: string) => Promise<string | null>,
) {
  const bruto = JSON.parse(
    await readFile(path.join(EXEMPLO, 'manifesto.json'), 'utf8'),
  )
  const v = validarManifesto(bruto)
  if (!('manifesto' in v)) throw new Error(v.erros.join('; '))
  return planejar(v.manifesto, {
    agora: 1_700_000_000_000,
    autorId: 'migracao',
    verificarLink,
    lerConteudo: (a: ManifestoArtigo) =>
      a.arquivo
        ? readFile(path.join(EXEMPLO, a.arquivo), 'utf8')
        : Promise.resolve(a.conteudo ?? ''),
    resolverImagem: criarResolvedorImagens({
      baseDir: EXEMPLO,
      cloudinary: null,
      cache: new Map(),
    }),
  })
}

describe('validarManifesto', () => {
  it('aceita o export de exemplo', async () => {
    const bruto = JSON.parse(
      await readFile(path.join(EXEMPLO, 'manifesto.json'), 'utf8'),
    )
    expect('manifesto' in validarManifesto(bruto)).toBe(true)
  })

  it('aponta ids duplicados, pai inexistente, ciclos e conteúdo ambíguo', () => {
    const r = validarManifesto({
      blocos: [
        { id: 'a', nome: 'A' },
        { id: 'a', nome: 'A2' },
        { id: 'p', nome: 'P', pai: 'q' },
        { id: 'q', nome: 'Q', pai: 'p' },
        { id: 'c', nome: 'C', pai: 'zzz' },
      ],
      artigos: [
        { id: 'x', bloco: 'a', titulo: 'X' },
        {
          id: 'y',
          bloco: 'a',
          titulo: 'Y',
          arquivo: 'y.html',
          conteudo: '<p/>',
        },
        { id: 'z', bloco: 'a', titulo: 'Z', conteudo: '', formato: 'rtf' },
      ],
    })
    const msg = r.erros.join('\n')
    expect(msg).toMatch(/id duplicado "a"/)
    expect(msg).toMatch(/pai "zzz" não existe/)
    expect(msg).toMatch(/ciclo/)
    expect(msg).toMatch(/x\): use `arquivo` ou `conteudo`/)
    expect(msg).toMatch(/y\): use `arquivo` ou `conteudo`/)
    expect(msg).toMatch(/formato "rtf"/)
  })

  it('exige listas', () => {
    expect(validarManifesto({}).erros).toHaveLength(2)
    expect(validarManifesto(null).erros).toHaveLength(1)
  })
})

describe('criarGeradorDeIds', () => {
  it('é legível e só ganha sufixo em colisões', () => {
    const id = criarGeradorDeIds('m')
    expect(id('Meu Produto')).toBe('m-meu-produto')
    expect(id('meu-produto')).toMatch(/^m-meu-produto-[0-9a-f]{6}$/)
  })
})

describe('detectarTipo', () => {
  it('reconhece pelos bytes, ignorando a extensão', () => {
    expect(detectarTipo(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe(
      'image/gif',
    )
    expect(detectarTipo(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })
})

describe('planejar (export de exemplo)', () => {
  it('monta a hierarquia com productId desnormalizado', async () => {
    const { blocos } = await planoDoExemplo()
    const produto = blocos.find((b) => b.nome === 'Smartshare')
    const bpm = blocos.find((b) => b.nome === 'BPM')
    expect(produto).toMatchObject({ parentId: null, productId: produto?.id })
    expect(bpm).toMatchObject({ parentId: produto?.id, productId: produto?.id })
    expect(bpm?.ordem).toBe(0)
    expect(blocos.find((b) => b.nome === 'ECM')?.ordem).toBe(1)
  })

  it('importa só artigos com bloco e relata o órfão', async () => {
    const { artigos, relatorio } = await planoDoExemplo()
    expect(artigos.map((a) => a.titulo)).toEqual([
      'Como acessar o BPM',
      'Fluxo de aprovação',
      'Tipos de documento',
    ])
    expect(relatorio.artigosSemBloco).toEqual([
      { id: 'orfao', titulo: 'Artigo órfão', bloco: 'nao-existe' },
    ])
  })

  it('converte HTML e Markdown, remove scripts e gera texto plano e resumo', async () => {
    const { artigos } = await planoDoExemplo()
    const login = artigos[0]
    expect(login?.textoPlano).toContain('Abra o sistema')
    expect(login?.textoPlano).not.toContain('alert')
    expect(login?.resumo.length).toBeGreaterThan(0)
    const fluxo = artigos[1]
    expect(JSON.stringify(fluxo?.conteudo)).toContain('"bulletList"')
    expect(fluxo).toMatchObject({ publico: 'tecnico', versaoProduto: '4.2' })
  })

  it('preserva status, versão e datas do export', async () => {
    const { artigos } = await planoDoExemplo()
    expect(artigos[0]).toMatchObject({
      status: 'published',
      versao: 1,
      atualizadoEm: Date.parse('2025-03-10'),
      revisadoEm: Date.parse('2025-03-10'),
    })
    expect(artigos[2]).toMatchObject({ status: 'draft', versao: 0 })
  })

  it('troca imagens válidas, gera alt faltante e relata falhas', async () => {
    const { artigos, relatorio } = await planoDoExemplo()
    const imagens = (a?: { conteudo: unknown }) =>
      JSON.stringify(a?.conteudo).match(/"type":"image"/g)?.length ?? 0
    expect(imagens(artigos[0])).toBe(1)
    expect(JSON.stringify(artigos[0]?.conteudo)).toContain('simulacao://')
    expect(relatorio.altsGerados).toHaveLength(1)
    expect(relatorio.altsGerados[0]?.alt).toContain('Fluxo de aprovação')
    expect(relatorio.imagensComFalha).toEqual([
      expect.objectContaining({
        src: '../imagens/nao-existe.png',
        motivo: 'arquivo não encontrado',
      }),
    ])
    expect(JSON.stringify(artigos[1]?.conteudo)).toContain(
      '[Imagem não migrada',
    )
    expect(relatorio.resumo).toMatchObject({ imagensOk: 2, imagensComFalha: 1 })
  })

  it('resolve links entre artigos e relata os quebrados', async () => {
    const { artigos, relatorio } = await planoDoExemplo()
    const [login, fluxo] = artigos
    expect(JSON.stringify(login?.conteudo)).toContain(
      `"href":"/a/${fluxo?.id}"`,
    )
    expect(JSON.stringify(fluxo?.conteudo)).toContain(
      `"href":"/a/${login?.id}"`,
    )
    expect(relatorio.linksQuebrados).toEqual([
      expect.objectContaining({ artigo: 'fluxo', href: 'antigo/sumiu.html' }),
    ])
    // o texto do link quebrado continua no artigo
    expect(fluxo?.textoPlano).toContain('uma página que sumiu')
  })

  it('confere links externos quando pedido', async () => {
    const { relatorio } = await planoDoExemplo(async (h) =>
      h.includes('example.com') ? 'HTTP 404' : null,
    )
    expect(relatorio.linksQuebrados.map((l) => l.href)).toContain(
      'https://example.com/ajuda',
    )
  })

  it('avisa sobre elementos sem suporte', async () => {
    const { relatorio } = await planoDoExemplo()
    expect(relatorio.avisos).toEqual([
      expect.objectContaining({
        artigo: 'tabela',
        mensagem: expect.stringContaining('table'),
      }),
    ])
  })
})

describe('imagens', () => {
  it('rejeita caminhos fora da pasta do export e arquivos que não são imagem', async () => {
    const resolver = criarResolvedorImagens({
      baseDir: EXEMPLO,
      cloudinary: null,
      cache: new Map(),
    })
    expect(await resolver('../../../../package.json')).toEqual({
      erro: 'caminho fora da pasta de exportação',
    })
    expect(await resolver('manifesto.json')).toEqual({
      erro: 'não é PNG, JPG ou GIF',
    })
  })

  it('envia uma vez por conteúdo e reaproveita o cache', async () => {
    const enviados: string[] = []
    const cache = new Map<string, string>()
    const resolver = criarResolvedorImagens({
      baseDir: EXEMPLO,
      cache,
      cloudinary: { cloudName: 'x', uploadPreset: 'y' },
      enviar: async (img) => {
        enviados.push(img.hash)
        return `https://cdn.test/${img.hash.slice(0, 6)}.png`
      },
    })
    const a = await resolver('imagens/tela-login.png')
    const b = await resolver('artigos/../imagens/tela-login.png')
    expect(a).toEqual(b)
    expect(enviados).toHaveLength(1)
    expect(cache.size).toBe(1)
  })

  it('relata falha do Cloudinary sem derrubar o plano', async () => {
    const resolver = criarResolvedorImagens({
      baseDir: EXEMPLO,
      cache: new Map(),
      cloudinary: { cloudName: 'x', uploadPreset: 'y' },
      enviar: async () => {
        throw new Error('Cloudinary respondeu HTTP 500')
      },
    })
    expect(await resolver('imagens/fluxo.gif')).toEqual({
      erro: 'Cloudinary respondeu HTTP 500',
    })
  })
})

describe('relatório', () => {
  it('lista as pendências em Markdown', async () => {
    const { relatorio } = await planoDoExemplo()
    expect(temPendencias(relatorio)).toBe(true)
    const md = relatorioEmMarkdown(relatorio, true)
    expect(md).toContain('simulação, nada foi gravado')
    expect(md).toContain('## Imagens com falha (1)')
    expect(md).toContain('## Artigos sem bloco (1)')
    expect(md).toContain('nao-existe')
  })
})

describe('--sem-imagens', () => {
  async function planoSemImagens() {
    const bruto = JSON.parse(
      await readFile(path.join(EXEMPLO, 'manifesto.json'), 'utf8'),
    )
    const v = validarManifesto(bruto)
    if (!('manifesto' in v)) throw new Error(v.erros.join('; '))
    return planejar(v.manifesto, {
      agora: 1_700_000_000_000,
      autorId: 'migracao',
      lerConteudo: (a: ManifestoArtigo) =>
        a.arquivo
          ? readFile(path.join(EXEMPLO, a.arquivo), 'utf8')
          : Promise.resolve(a.conteudo ?? ''),
      resolverImagem: criarResolvedorImagens({
        baseDir: EXEMPLO,
        cloudinary: null,
        cache: new Map(),
        pular: true,
      }),
    })
  }

  it('não baixa nem valida imagens: nada vira falha', async () => {
    const { relatorio } = await planoSemImagens()
    expect(relatorio.resumo).toMatchObject({
      imagensOk: 0,
      imagensComFalha: 0,
      imagensPuladas: 3,
    })
    expect(relatorio.imagensComFalha).toEqual([])
    expect(relatorio.altsGerados).toEqual([])
  })

  it('deixa um marcador com o endereço original no lugar de cada imagem', async () => {
    const { artigos } = await planoSemImagens()
    const login = JSON.stringify(artigos[0]?.conteudo)
    expect(login).not.toContain('"type":"image"')
    expect(login).toContain('[Imagem não migrada: ../imagens/tela-login.png]')
    expect(artigos[0]?.textoPlano).toContain('[Imagem não migrada')
  })

  it('o relatório explica como trazer as imagens depois', async () => {
    const { relatorio } = await planoSemImagens()
    const md = relatorioEmMarkdown(relatorio, true)
    expect(md).toContain('Imagens puladas')
    expect(md).toContain('--sobrescrever')
  })

  it('não confere se o arquivo existe (nem acessa a rede)', async () => {
    const resolver = criarResolvedorImagens({
      baseDir: EXEMPLO,
      cloudinary: null,
      cache: new Map(),
      pular: true,
    })
    expect(await resolver('https://exemplo.invalid/x.png')).toEqual({
      pulada: true,
    })
    expect(await resolver('nao-existe.png')).toEqual({ pulada: true })
  })
})
