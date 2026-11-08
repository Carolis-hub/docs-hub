import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from './Home'

const useAuth = vi.fn()
const carregarVisaoGeral = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../services/blocks', () => ({
  createBlock: vi.fn(),
  deleteBlock: vi.fn(),
  updateBlock: vi.fn(),
}))
vi.mock('../services/visaoGeral', () => ({
  carregarVisaoGeral: (...args: unknown[]) => carregarVisaoGeral(...args),
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

const visao = (extra: Record<string, unknown> = {}) => ({
  produtos: [produto],
  unidades: [],
  subprodutos: {},
  artigos: { p1: 8 },
  ...extra,
})

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
  it('mostra os subprodutos e a contagem dentro do cartão do produto', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: ['p1'] },
    })
    carregarVisaoGeral.mockResolvedValue(
      visao({
        subprodutos: {
          p1: [{ ...produto, id: 's1', nome: 'BPM', parentId: 'p1' }],
        },
      }),
    )
    renderHome()
    const link = await screen.findByRole('link', { name: 'BPM' })
    expect(link).toHaveAttribute('href', '/b/s1')
    expect(screen.getByText('1 subproduto · 8 artigos')).toBeInTheDocument()
  })

  it('admin vê os produtos e o botão de criar', async () => {
    useAuth.mockReturnValue({ isAdmin: true, profile: { uid: 'a' } })
    carregarVisaoGeral.mockResolvedValue(visao())
    renderHome()
    expect(await screen.findByText('Smartshare')).toBeInTheDocument()
    expect(carregarVisaoGeral).toHaveBeenCalledWith(undefined, true)
    expect(
      screen.getByRole('button', { name: /novo produto/i }),
    ).toBeInTheDocument()
  })

  it('leitor só consulta os produtos permitidos e não vê controles', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: ['p1'] },
    })
    carregarVisaoGeral.mockResolvedValue(visao())
    renderHome()
    expect(await screen.findByText('Smartshare')).toBeInTheDocument()
    expect(carregarVisaoGeral).toHaveBeenCalledWith(['p1'], false)
    expect(screen.queryByRole('button', { name: /novo produto/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /nova bu/i })).toBeNull()
  })

  it('avisa o leitor sem produtos', async () => {
    useAuth.mockReturnValue({
      isAdmin: false,
      profile: { uid: 'l', produtosPermitidos: [] },
    })
    carregarVisaoGeral.mockResolvedValue(visao({ produtos: [] }))
    renderHome()
    expect(
      await screen.findByText(/não tem acesso a nenhum produto/i),
    ).toBeInTheDocument()
  })

  it('mostra as unidades de negócio como cartões e os produtos sem unidade à parte', async () => {
    useAuth.mockReturnValue({ isAdmin: true, profile: { uid: 'a' } })
    carregarVisaoGeral.mockResolvedValue(
      visao({
        unidades: [
          {
            id: 'u1',
            nome: 'Process Solution',
            slug: 'process-solution',
            descricao: 'Gestão de processos',
            icone: '',
            ordem: 0,
          },
        ],
        produtos: [
          { ...produto, unidadeId: 'u1' },
          { ...produto, id: 'p2', productId: 'p2', nome: 'Solto' },
        ],
        artigos: { p1: 8, p2: 1 },
      }),
    )
    renderHome()
    const cartao = await screen.findByRole('link', {
      name: /process solution/i,
    })
    expect(cartao).toHaveAttribute('href', '/u/u1')
    expect(cartao).toHaveTextContent('1 produto')
    expect(cartao).toHaveTextContent('8 artigos')
    expect(
      screen.getByRole('heading', { name: /sem unidade/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Solto')).toBeInTheDocument()
  })
})
