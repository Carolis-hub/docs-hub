import { describe, expect, it } from 'vitest'
import { estaEmConfiguracoes } from './governanca'

describe('estaEmConfiguracoes', () => {
  it('reconhece Configurações e as telas de Governança', () => {
    expect(estaEmConfiguracoes('/admin/configuracoes')).toBe(true)
    expect(estaEmConfiguracoes('/admin/revisao')).toBe(true)
    expect(estaEmConfiguracoes('/admin/revisao/abc')).toBe(true)
    expect(estaEmConfiguracoes('/admin/auditoria')).toBe(true)
  })
  it('não confunde com outras telas', () => {
    expect(estaEmConfiguracoes('/admin/metricas')).toBe(false)
    expect(estaEmConfiguracoes('/admin/revisaoX')).toBe(false)
  })
})
