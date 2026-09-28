import { beforeEach, describe, expect, it, vi } from 'vitest'

const commitMock = vi.fn().mockResolvedValue(undefined)
const updateMock = vi.fn()
const setMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  collectionGroup: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: vi.fn(),
  increment: vi.fn((n: number) => ({ __increment: n })),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  Timestamp: class {},
  where: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: updateMock,
    set: setMock,
    commit: commitMock,
  })),
}))

const { registrarVisualizacao } = await import('./metrics')

describe('registrarVisualizacao', () => {
  beforeEach(() => {
    localStorage.clear()
    commitMock.mockClear()
    updateMock.mockClear()
    setMock.mockClear()
  })

  it('não registra nada para admins', async () => {
    await registrarVisualizacao('artigo-1', 'admin-1', 'admin')
    expect(commitMock).not.toHaveBeenCalled()
  })

  it('registra a primeira visualização de um leitor', async () => {
    await registrarVisualizacao('artigo-1', 'leitor-1', 'reader')
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(commitMock).toHaveBeenCalledTimes(1)
  })

  it('não registra de novo o mesmo leitor, artigo e dia', async () => {
    await registrarVisualizacao('artigo-1', 'leitor-1', 'reader')
    await registrarVisualizacao('artigo-1', 'leitor-1', 'reader')
    expect(commitMock).toHaveBeenCalledTimes(1)
  })

  it('conta separadamente leitores diferentes no mesmo artigo', async () => {
    await registrarVisualizacao('artigo-1', 'leitor-1', 'reader')
    await registrarVisualizacao('artigo-1', 'leitor-2', 'reader')
    expect(commitMock).toHaveBeenCalledTimes(2)
  })
})
