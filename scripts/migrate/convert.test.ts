// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { converter, separarImagensComLink } from './convert.ts'

const deps = {
  titulo: 'T',
  resolverImagem: async (src: string) => ({ url: src }),
  resolverLink: async (href: string) => ({ tipo: 'manter' as const, href }),
  aoFalharImagem: () => {},
  aoGerarAlt: () => {},
  aoQuebrarLink: () => {},
}

describe('separarImagensComLink', () => {
  it('deixa a imagem e põe o link como texto logo abaixo', () => {
    const r = separarImagensComLink(
      '<p><strong>Dúvida?</strong> <a href="https://portal.exemplo.com/x"><img src="i.png" alt=""></a></p>',
    )
    expect(r.total).toBe(1)
    expect(r.html).toContain(
      '<img src="i.png" alt=""><p><a href="https://portal.exemplo.com/x">portal.exemplo.com</a></p>',
    )
  })

  it('usa o alt da imagem como rótulo, quando existe', () => {
    const r = separarImagensComLink(
      '<a href="/a/1"><img src="i.png" alt="Abrir o manual"></a>',
    )
    expect(r.html).toContain('>Abrir o manual</a>')
  })

  it('não mexe em links com texto nem em imagens soltas', () => {
    const html = '<a href="/a/1">texto <img src="i.png"></a><img src="j.png">'
    expect(separarImagensComLink(html)).toEqual({ html, total: 0 })
  })
})

describe('converter: imagem dentro de link', () => {
  it('não perde o link', async () => {
    const r = await converter(
      '**Possui dúvida?** [![](https://x/g.png)](https://portal.exemplo.com/abc)',
      'markdown',
      deps,
    )
    const json = JSON.stringify(r.doc)
    expect(r.imagensComLink).toBe(1)
    expect(json).toContain('"type":"image"')
    expect(json).toContain('"href":"https://portal.exemplo.com/abc"')
  })
})
