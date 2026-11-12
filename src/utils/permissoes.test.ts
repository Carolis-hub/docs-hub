import { describe, expect, it } from 'vitest'
import {
  limparPermissoes,
  permissaoDaRota,
  permissoesCompletas,
  podeAcessar,
  primeiraRotaPermitida,
} from './permissoes'

const leitor = (permissoes?: Record<string, boolean>) => ({
  role: 'reader' as const,
  permissoes,
})
const admin = (permissoes?: Record<string, boolean>) => ({
  role: 'admin' as const,
  permissoes,
})

describe('podeAcessar', () => {
  it('conta antiga, sem permissões gravadas, mantém o acesso de sempre', () => {
    expect(podeAcessar(leitor(), 'manual')).toBe(true)
    expect(podeAcessar(leitor(), 'busca')).toBe(true)
    expect(podeAcessar(admin(), 'auditoria')).toBe(true)
  })

  it('bloqueia só o que foi marcado como false', () => {
    const p = leitor({ manual: false })
    expect(podeAcessar(p, 'manual')).toBe(false)
    expect(podeAcessar(p, 'busca')).toBe(true)
  })

  it('telas de administração nunca abrem para leitor', () => {
    expect(podeAcessar(leitor({ usuarios: true }), 'usuarios')).toBe(false)
  })

  it('admin pode ter uma tela de administração bloqueada', () => {
    expect(podeAcessar(admin({ auditoria: false }), 'auditoria')).toBe(false)
    expect(podeAcessar(admin({ auditoria: false }), 'revisao')).toBe(true)
  })

  it('sem perfil, nada', () => {
    expect(podeAcessar(null, 'manual')).toBe(false)
  })
})

describe('permissoesCompletas e limparPermissoes', () => {
  it('completam o mapa e ignoram o que não é conhecido', () => {
    const m = limparPermissoes({ manual: false, inventada: false, busca: 'x' })
    expect(m.manual).toBe(false)
    expect(m.busca).toBe(true)
    expect(m).not.toHaveProperty('inventada')
    expect(Object.keys(permissoesCompletas(undefined))).toEqual(Object.keys(m))
  })
})

describe('rotas', () => {
  it('manda quem perdeu o manual para o assistente, e quem perdeu tudo para lugar nenhum', () => {
    expect(primeiraRotaPermitida(leitor())).toBe('/')
    expect(primeiraRotaPermitida(leitor({ manual: false }))).toBe('/assistente')
    expect(
      primeiraRotaPermitida(leitor({ manual: false, busca: false })),
    ).toBeNull()
  })

  it('associa a rota de administração à permissão', () => {
    expect(permissaoDaRota('/admin/usuarios')).toBe('usuarios')
    expect(permissaoDaRota('/admin/auditoria')).toBe('auditoria')
    expect(permissaoDaRota('/admin/unidades')).toBeUndefined()
  })
})
