import { beforeEach, describe, expect, it, vi } from 'vitest'

const commit = vi.fn()
const update = vi.fn()
const set = vi.fn()
vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: (_db: unknown, ...p: string[]) => p.join('/'),
  increment: (n: number) => ({ inc: n }),
  writeBatch: () => ({ update, set, commit }),
}))

const { registrarVisualizacao } = await import('./metrics')

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  commit.mockResolvedValue(undefined)
})

describe('registrarVisualizacao', () => {
  const dia = new Date(2026, 4, 10, 10)

  it('soma no total e no dia, em um único batch', async () => {
    expect(await registrarVisualizacao('a1', 'u1', dia)).toBe(true)
    expect(update).toHaveBeenCalledWith('articles/a1', { views: { inc: 1 } })
    expect(set).toHaveBeenCalledWith(
      'articles/a1/viewsDaily/2026-05-10',
      { count: { inc: 1 }, dia: '2026-05-10' },
      { merge: true },
    )
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('não conta de novo o mesmo leitor, artigo e dia', async () => {
    await registrarVisualizacao('a1', 'u1', dia)
    expect(await registrarVisualizacao('a1', 'u1', dia)).toBe(false)
    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('conta outro leitor, outro artigo e outro dia', async () => {
    await registrarVisualizacao('a1', 'u1', dia)
    expect(await registrarVisualizacao('a1', 'u2', dia)).toBe(true)
    expect(await registrarVisualizacao('a2', 'u1', dia)).toBe(true)
    expect(await registrarVisualizacao('a1', 'u1', new Date(2026, 4, 11))).toBe(
      true,
    )
  })

  it('libera nova tentativa se a gravação falhar', async () => {
    commit.mockRejectedValueOnce(new Error('offline'))
    expect(await registrarVisualizacao('a1', 'u1', dia)).toBe(false)
    expect(await registrarVisualizacao('a1', 'u1', dia)).toBe(true)
  })
})
