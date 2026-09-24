import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('remove acentos e espaços', () => {
    expect(slugify('Configuração de Usuário')).toBe('configuracao-de-usuario')
  })

  it('remove caracteres especiais', () => {
    expect(slugify('BPM: Como criar um fluxo?')).toBe('bpm-como-criar-um-fluxo')
  })

  it('colapsa hifens repetidos e remove das bordas', () => {
    expect(slugify('  --Smartshare--  ')).toBe('smartshare')
  })
})
