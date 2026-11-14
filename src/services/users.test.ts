import { describe, expect, it, vi } from 'vitest'

vi.mock('./firebase', () => ({ auth: {}, db: {}, getSecondaryAuth: vi.fn() }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
}))
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updatePassword: vi.fn(),
}))

const {
  normalizarPermissoes,
  setUserAtivo,
  createUser,
  conferirSenha,
  deleteUsers,
} = await import('./users')

describe('normalizarPermissoes', () => {
  it('admin ignora produtos e sempre vê técnico', () => {
    expect(
      normalizarPermissoes({
        nome: 'A',
        role: 'admin',
        produtosPermitidos: ['p1'],
        verTecnico: false,
      }),
    ).toMatchObject({ produtosPermitidos: [], verTecnico: true })
  })

  it('leitor mantém o que foi escolhido', () => {
    const leitor = {
      nome: 'L',
      role: 'reader' as const,
      produtosPermitidos: ['p1'],
      verTecnico: false,
    }
    expect(normalizarPermissoes(leitor)).toEqual(leitor)
  })
})

describe('setUserAtivo', () => {
  it('impede o admin de desativar a própria conta', async () => {
    await expect(setUserAtivo('a1', false, 'a1')).rejects.toThrow(/própria/)
  })
})

describe('createUser', () => {
  const base = {
    nome: 'Ana',
    email: 'ana@x.com',
    role: 'reader' as const,
    produtosPermitidos: [],
    verTecnico: false,
  }
  it('exige senha com 6 caracteres', async () => {
    await expect(createUser({ ...base, senha: '123' }, 'a')).rejects.toThrow(
      /6 caracteres/,
    )
  })
  it('exige nome', async () => {
    await expect(
      createUser({ ...base, nome: ' ', senha: '123456' }, 'a'),
    ).rejects.toThrow(/nome/i)
  })
})

describe('conferirSenha', () => {
  it('exige 6 caracteres e confirmação igual', () => {
    expect(conferirSenha('123', '123')).toMatch(/6 caracteres/)
    expect(conferirSenha('segredo1', 'segredo2')).toMatch(/não são iguais/)
    expect(conferirSenha('segredo1', 'segredo1')).toBeNull()
  })
})

describe('deleteUsers', () => {
  it('não deixa excluir a própria conta, nem dentro de um lote', async () => {
    await expect(deleteUsers(['u1', 'a'], 'a')).rejects.toThrow('própria conta')
  })
})
