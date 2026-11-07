import { describe, expect, it } from 'vitest'
import { artigoDoAlvo, grupoDaAcao, rotuloDaAuditoria } from './auditoria'

describe('auditoria', () => {
  it('traduz as ações conhecidas e mantém as desconhecidas', () => {
    expect(rotuloDaAuditoria('artigo.aprovar')).toBe('Aprovou')
    expect(rotuloDaAuditoria('coisa.nova')).toBe('coisa.nova')
  })

  it('agrupa pelo prefixo da ação', () => {
    expect(grupoDaAcao('revisao.salvar')).toBe('revisao')
    expect(grupoDaAcao('simples')).toBe('simples')
  })

  it('acha o artigo no alvo, inclusive dentro de subcoleções', () => {
    expect(artigoDoAlvo('articles/abc')).toBe('abc')
    expect(artigoDoAlvo('articles/abc/suggestions/s1')).toBe('abc')
    expect(artigoDoAlvo('blocks/b1')).toBeNull()
  })
})
