import { describe, expect, it } from 'vitest'
import { entradasVisiveis, modoAsideValido } from './aside'

describe('aside', () => {
  it('admin vê conforme o modo', () => {
    expect(entradasVisiveis('toda', true)).toEqual(['manual', 'busca'])
    expect(entradasVisiveis('manual', true)).toEqual(['manual'])
    expect(entradasVisiveis('busca', true)).toEqual(['busca'])
    expect(entradasVisiveis('oculta', true)).toEqual([])
  })
  it('quem não é admin nunca vê a aside', () => {
    expect(entradasVisiveis('toda', false)).toEqual([])
  })
  it('valor inválido volta para toda', () => {
    expect(modoAsideValido('x')).toBe('toda')
    expect(modoAsideValido(null)).toBe('toda')
    expect(modoAsideValido('manual')).toBe('manual')
  })
})
