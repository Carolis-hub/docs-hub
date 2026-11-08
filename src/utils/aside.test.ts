import { describe, expect, it } from 'vitest'
import { entradasVisiveis, modoAsideValido } from './aside'

describe('aside', () => {
  it('mostra as entradas conforme o modo escolhido', () => {
    expect(entradasVisiveis('toda')).toEqual(['manual', 'busca'])
    expect(entradasVisiveis('manual')).toEqual(['manual'])
    expect(entradasVisiveis('busca')).toEqual(['busca'])
    expect(entradasVisiveis('oculta')).toEqual([])
  })
  it('valor inválido volta para toda', () => {
    expect(modoAsideValido('x')).toBe('toda')
    expect(modoAsideValido(null)).toBe('toda')
    expect(modoAsideValido('manual')).toBe('manual')
  })
})
