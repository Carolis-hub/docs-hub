import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuth = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => ({
    dados: {
      motor: {
        buscar: () => [
          {
            item: {
              id: 'r1',
              titulo: 'Regras de escalonamento',
              resumo: '',
              blockId: 'b',
              productId: 'p',
              categoria: 'configuracoes',
              publico: 'usuario',
            },
            score: 1,
            termos: [],
          },
        ],
        listar: () => [],
        total: 1,
      },
    },
  }),
}))
vi.mock('../components/ArticleContent', () => ({
  ArticleContent: () => <div>conteúdo</div>,
}))
vi.mock('../services/articles', () => ({
  getArticle: vi.fn(async () => ({
    id: 'a1',
    blockId: 'b',
    productId: 'p',
    titulo: 'Configurar um fluxo',
    resumo: 'Fluxos de aprovação',
    categoria: 'processos',
    status: 'published',
    publico: 'usuario',
    views: 1841,
    atualizadoEm: new Date(2026, 10, 3).getTime(),
    conteudo: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Antes de começar' }],
        },
      ],
    },
  })),
}))
vi.mock('../services/blocks', () => ({
  getBlock: vi.fn(async () => null),
  getAncestors: vi.fn(async () => []),
}))
vi.mock('../services/metrics', () => ({ registrarVisualizacao: vi.fn() }))
vi.mock('../services/unidades', () => ({ getUnidade: vi.fn(async () => null) }))

beforeEach(() => {
  useAuth.mockReturnValue({ user: { uid: 'l' }, isAdmin: false })
})

describe('ArticlePage', () => {
  it('mostra categoria, visualizações, sumário e relacionados', async () => {
    const { ArticlePage } = await import('./ArticlePage')
    render(
      <MemoryRouter initialEntries={['/a/a1']}>
        <Routes>
          <Route path="/a/:articleId" element={<ArticlePage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Configurar um fluxo' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/1\.841 visualizações/)).toBeInTheDocument()
    expect(screen.getAllByText('Processos').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'Antes de começar' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /regras de escalonamento/i }),
    ).toHaveAttribute('href', '/a/r1')
  })
})
