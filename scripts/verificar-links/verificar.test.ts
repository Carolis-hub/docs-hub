// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  emParalelo,
  motivoInterno,
  relatorioEmMarkdown,
  verificarArtigos,
  type ArtigoParaVerificar,
  type DepsVerificacao,
} from './verificar.ts'

const link = (href: string) => ({
  type: 'text',
  text: 'x',
  marks: [{ type: 'link', attrs: { href } }],
})
const imagem = (src: string) => ({ type: 'image', attrs: { src, alt: 'a' } })
const artigo = (
  id: string,
  status: 'draft' | 'published',
  ...filhos: unknown[]
): ArtigoParaVerificar => ({
  id,
  titulo: `Artigo ${id}`,
  status,
  conteudo: {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: filhos.filter(
          (f) => (f as { type: string }).type === 'text',
        ) as never[],
      },
      ...(filhos.filter(
        (f) => (f as { type: string }).type === 'image',
      ) as never[]),
    ],
  },
})

const base: DepsVerificacao = {
  artigos: new Map([
    ['a1', 'published'],
    ['a2', 'published'],
    ['rasc', 'draft'],
  ]),
  blocos: new Set(['b1']),
}

describe('motivoInterno', () => {
  it.each([
    ['/a/a2', null],
    ['/a/a2?x=1#y', null],
    ['/a/sumiu', 'o artigo não existe mais'],
    ['/a/rasc', 'o artigo está em rascunho'],
    ['/b/b1', null],
    ['/b/b9', 'o bloco não existe mais'],
    ['#topo', 'âncora interna não suportada'],
    [
      '/busca?q=x',
      'link relativo que não aponta para nenhuma página do docs-hub',
    ],
  ])('%s', (href, esperado) => {
    expect(motivoInterno(href, base)).toBe(esperado)
  })
})

describe('verificarArtigos', () => {
  it('acha links internos e imagens relativas quebrados, só em artigos publicados', async () => {
    const r = await verificarArtigos(
      [
        artigo(
          'a1',
          'published',
          link('/a/a2'),
          link('/a/sumiu'),
          link('mailto:a@b.c'),
          imagem('foto.png'),
        ),
        artigo('rasc', 'draft', link('/a/sumiu')),
      ],
      base,
    )
    expect(r.artigosVerificados).toBe(1)
    expect(r.quebrados.map((a) => [a.tipo, a.alvo])).toEqual([
      ['link', '/a/sumiu'],
      ['imagem', 'foto.png'],
    ])
  })

  it('confere cada URL externa uma vez e classifica o resultado', async () => {
    const checarUrl = vi.fn(async (url: string) =>
      url.includes('morto')
        ? ({ estado: 'quebrado', motivo: 'HTTP 404' } as const)
        : url.includes('bloqueia')
          ? ({ estado: 'inconclusivo', motivo: 'HTTP 403' } as const)
          : ({ estado: 'ok' } as const),
    )
    const r = await verificarArtigos(
      [
        artigo(
          'a1',
          'published',
          link('https://ok.com/x'),
          link('https://morto.com/p'),
          imagem('https://cdn.com/i.png'),
        ),
        artigo(
          'a2',
          'published',
          link('https://morto.com/p'),
          link('https://bloqueia.com'),
        ),
      ],
      { ...base, checarUrl },
    )
    expect(checarUrl).toHaveBeenCalledTimes(4) // morto.com só uma vez
    expect(r.urlsVerificadas).toBe(4)
    expect(r.quebrados.map((a) => a.artigoId)).toEqual(['a1', 'a2'])
    expect(r.inconclusivos.map((a) => a.alvo)).toEqual(['https://bloqueia.com'])
  })

  it('sem checarUrl pula as externas', async () => {
    const r = await verificarArtigos(
      [artigo('a1', 'published', link('https://x.com'))],
      base,
    )
    expect(r).toMatchObject({
      urlsVerificadas: 0,
      quebrados: [],
      inconclusivos: [],
    })
  })

  it('gera o relatório em Markdown', async () => {
    const r = await verificarArtigos(
      [artigo('a1', 'published', link('/a/sumiu'))],
      base,
    )
    const md = relatorioEmMarkdown(r)
    expect(md).toContain('## Quebrados (1)')
    expect(md).toContain(
      '[Artigo a1](/a/a1) | link | /a/sumiu | o artigo não existe mais',
    )
  })
})

describe('emParalelo', () => {
  it('respeita o limite de concorrência', async () => {
    let ativos = 0
    let maximo = 0
    await emParalelo([1, 2, 3, 4, 5, 6], 2, async () => {
      ativos++
      maximo = Math.max(maximo, ativos)
      await new Promise((r) => setTimeout(r, 5))
      ativos--
    })
    expect(maximo).toBe(2)
  })
})
