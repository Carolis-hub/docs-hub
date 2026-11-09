import { describe, expect, it } from 'vitest'
import { lerTextoRico } from './textoRico'

describe('lerTextoRico', () => {
  it('separa parágrafos, negrito e links', () => {
    const p = lerTextoRico(
      'Veja **isto** em https://x.com/a.\n\nSegundo parágrafo',
    )
    expect(p).toHaveLength(2)
    expect(p[0]).toEqual([
      { tipo: 'texto', texto: 'Veja ' },
      { tipo: 'negrito', texto: 'isto' },
      { tipo: 'texto', texto: ' em ' },
      { tipo: 'link', texto: 'https://x.com/a', url: 'https://x.com/a' },
      { tipo: 'texto', texto: '.' },
    ])
    expect(p[1]).toEqual([{ tipo: 'texto', texto: 'Segundo parágrafo' }])
  })
  it('texto vazio não gera parágrafos', () => {
    expect(lerTextoRico('  \n ')).toEqual([])
  })
})
