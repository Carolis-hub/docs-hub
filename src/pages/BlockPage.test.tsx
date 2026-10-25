import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Block } from '../types/content'

const useAuth = vi.fn()
const getBlock = vi.fn()
const listChildren = vi.fn()
const getAncestors = vi.fn()
const listArticlesByBlock = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../services/blocks', () => ({
  getBlock: (...a: unknown[]) => getBlock(...a),
  listChildren: (...a: unknown[]) => listChildren(...a),
  getAncestors: (...a: unknown[]) => getAncestors(...a),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
}))
vi.mock('../services/articles', () => ({
  listArticlesByBlock: (...a: unknown[]) => listArticlesByBlock(...a),
}))

const bloco = (id: string, nome: string, parentId: string | null): Block => ({
  id,
  nome,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId: 'p',
})
const artigo = (id: string, titulo: string, resumo = ''): Article =>
  ({
    id,
    titulo,
    resumo,
    textoPlano: resumo,
    status: 'published',
    publico: 'usuario',
  }) as Article

async function abrir(id: string) {
  const { BlockPage } = await import('./BlockPage')
  localStorage.clear()
  render(
    <MemoryRouter initialEntries={[`/b/${id}`]}>
      <Routes>
        <Route path="/b/:blockId" element={<BlockPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const produto = bloco('p', 'SmartShare 4', null)
const anexos = bloco('anexos', 'Anexos', 'p')

beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { uid: 'u' }, isAdmin: true })
  getBlock.mockImplementation(async (id: string) =>
    id === 'p' ? produto : anexos,
  )
  getAncestors.mockImplementation(async (b: Block) =>
    b.id === 'p' ? [produto] : [produto, anexos],
  )
  listChildren.mockImplementation(async (id: string) =>
    id === 'p'
      ? [
          anexos,
          bloco('dash', 'Dashboard', 'p'),
          bloco('acesso', 'Acesso', 'p'),
        ]
      : [],
  )
  listArticlesByBlock.mockResolvedValue([
    artigo('1', 'Como excluir anexos?', 'Apague o arquivo.'),
    artigo('2', 'Como adicionar anexos?', 'Envie o arquivo.'),
    artigo('3', 'Como compartilhar?', 'Marque a revisão.'),
  ])
})

describe('BlockPage', () => {
  it('produto: mostra o subtítulo com a contagem e os cartões das seções', async () => {
    await abrir('p')
    expect(
      await screen.findByText('Produto · 3 subprodutos e seções'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Anexos' })).toHaveAttribute(
      'href',
      '/b/anexos',
    )
    expect(
      screen.getByRole('button', { name: 'Editar Anexos' }),
    ).toBeInTheDocument()
    // um botão no cabeçalho e o cartão tracejado no fim da grade
    expect(
      screen.getAllByRole('button', { name: /novo subbloco/i }),
    ).toHaveLength(2)
  })

  it('filtra as seções sem acento nem caixa', async () => {
    await abrir('p')
    await screen.findByText('Dashboard')
    fireEvent.change(screen.getByLabelText('Filtrar seções'), {
      target: { value: 'ACESSO' },
    })
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.getByRole('link', { name: 'Acesso' })).toBeInTheDocument()
  })

  it('o arrastar só aparece com "Organizar" ligado', async () => {
    await abrir('p')
    await screen.findByText('Dashboard')
    expect(screen.queryByRole('button', { name: /mover/i })).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Organizar' }))
    expect(screen.getAllByRole('button', { name: /^mover /i })).toHaveLength(3)
  })

  it('bloco sem subblocos não mostra a seção vazia', async () => {
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    expect(screen.queryByText('Subprodutos e seções')).toBeNull()
  })

  it('artigos: ordena de A a Z, inverte e filtra', async () => {
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    const titulos = () =>
      within(screen.getByRole('region', { name: 'Artigos' }))
        .getAllByRole('link')
        .map((l) => l.textContent ?? '')
    expect(titulos()[0]).toContain('Como adicionar anexos?')
    expect(titulos()[1]).toContain('Como compartilhar?')
    expect(titulos()[2]).toContain('Como excluir anexos?')
    fireEvent.click(screen.getByRole('button', { name: /A–Z/ }))
    expect(titulos()[0]).toContain('Como excluir')
    fireEvent.change(screen.getByLabelText('Filtrar neste bloco'), {
      target: { value: 'compartilhar' },
    })
    expect(titulos()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Filtrar neste bloco'), {
      target: { value: 'zzz' },
    })
    expect(
      screen.getByText('Nenhum artigo corresponde ao filtro.'),
    ).toBeInTheDocument()
  })

  it('alterna entre lista e grade e lembra a escolha', async () => {
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getByRole('button', { name: 'Ver em grade' }))
    expect(
      screen.getByRole('button', { name: 'Ver em grade' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('docs-hub:visao-artigos')).toBe('grade')
  })

  it('leitor não vê botões de edição nem "Organizar"', async () => {
    useAuth.mockReturnValue({ user: { uid: 'l' }, isAdmin: false })
    await abrir('p')
    await screen.findByText('Dashboard')
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByText(/novo subbloco/i)).toBeNull()
  })
})
