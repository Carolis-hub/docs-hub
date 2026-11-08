import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

const useAuth = vi.fn()
const listProducts = vi.fn()
const listUnidades = vi.fn()
const listChildren = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../services/blocks', () => ({
  listProducts: (...args: unknown[]) => listProducts(...args),
  listChildren: (...args: unknown[]) => listChildren(...args),
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  updateBlock: vi.fn(),
}))

vi.mock('../services/unidades', () => ({
  listUnidades: (...args: unknown[]) => listUnidades(...args),
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
  listUnidades.mockResolvedValue([])
  listChildren.mockResolvedValue([])
})

describe('Home', () => {
  it('mostra os subprodutos dentro do cartão do produto', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: ['p1'] },
    })
    listProducts.mockResolvedValue([produto])
    listChildren.mockResolvedValue([
      { ...produto, id: 's1', nome: 'BPM', parentId: 'p1' },
    ])
    renderHome()
    const link = await screen.findByRole('link', { name: 'BPM' })
    expect(link).toHaveAttribute('href', '/b/s1')
    expect(listChildren).toHaveBeenCalledWith('p1', 'p1')
  })

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

  it('agrupa os produtos por unidade de negócio', async () => {
    useAuth.mockReturnValue({ isAdmin: true, profile: { uid: 'a' } })
    listUnidades.mockResolvedValue([
      {
        id: 'u1',
        nome: 'Process Solution',
        slug: 'process-solution',
        descricao: '',
        icone: '',
        ordem: 0,
      },
    ])
    listProducts.mockResolvedValue([
      { ...produto, unidadeId: 'u1' },
      { ...produto, id: 'p2', productId: 'p2', nome: 'Solto' },
    ])
    renderHome()
    expect(
      await screen.findByRole('heading', { name: /process solution/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /sem unidade/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Smartshare')).toBeInTheDocument()
    expect(screen.getByText('Solto')).toBeInTheDocument()
  })
})
