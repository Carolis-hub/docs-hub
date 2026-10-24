import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

const useAuth = vi.fn()
const listProducts = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../services/blocks', () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  updateBlock: vi.fn(),
}))

const produto = {
  id: 'p1',
  nome: 'Smartshare',
  slug: 'smartshare',
  descricao: 'ECM e BPM',
  icone: '📦',
  ordem: 0,
  parentId: null,
  productId: 'p1',
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Home', () => {
  it('admin vê os produtos e o botão de criar', async () => {
    useAuth.mockReturnValue({ isAdmin: true, profile: { uid: 'a' } })
    listProducts.mockResolvedValue([produto])
    renderHome()
    expect(await screen.findByText('Smartshare')).toBeInTheDocument()
    expect(listProducts).toHaveBeenCalledWith(undefined)
    expect(
      screen.getByRole('button', { name: /novo produto/i }),
    ).toBeInTheDocument()
  })

  it('leitor só consulta os produtos permitidos e não vê controles', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: ['p1'] },
    })
    listProducts.mockResolvedValue([produto])
    renderHome()
    expect(await screen.findByText('Smartshare')).toBeInTheDocument()
    expect(listProducts).toHaveBeenCalledWith(['p1'])
    expect(screen.queryByRole('button', { name: /novo produto/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mover/i })).toBeNull()
  })

  it('avisa o leitor sem produtos', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: [] },
    })
    listProducts.mockResolvedValue([])
    renderHome()
    expect(
      await screen.findByText(/não tem acesso a nenhum produto/i),
    ).toBeInTheDocument()
  })
})
