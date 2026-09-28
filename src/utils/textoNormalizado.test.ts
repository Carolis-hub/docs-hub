import { describe, expect, it } from 'vitest'
import { normalizarTexto } from './textoNormalizado'

describe('normalizarTexto', () => {
  it('remove acentos e converte para minúsculas', () => {
    expect(normalizarTexto('Configuração')).toBe('configuracao')
  })

  it('preserva espaços e pontuação', () => {
    expect(normalizarTexto('Como criar um fluxo?')).toBe('como criar um fluxo?')
  })
})
