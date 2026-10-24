import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Suggestion } from '../../types/content'

const getArticle = vi.fn()
const publishArticle = vi.fn()
const getSuggestion = vi.fn()
const discardSuggestion = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'admin1' }, isAdmin: true }),
}))
vi.mock('../../components/ArticleContent', () => ({
  ArticleContent: ({ conteudo }: { conteudo: unknown }) => (
    <div data-testid="conteudo">{JSON.stringify(conteudo)}</div>
  ),
}))
vi.mock('../../services/articles', () => ({
  getArticle: (...a: unknown[]) => getArticle(...a),
  publishArticle: (...a: unknown[]) => publishArticle(...a),
}))
vi.mock('../../services/suggestions', async () => {
  const real = await vi
    .importActual<typeof import('../../services/suggestions')>(
      '../../services/suggestions',
    )
    .catch(() => null)
  return {
    getSuggestion: (...a: unknown[]) => getSuggestion(...a),
    discardSuggestion: (...a: unknown[]) => discardSuggestion(...a),
    sugestaoDefasada:
      real?.sugestaoDefasada ??
      ((s: Suggestion, a: Article) =>
        a.versao !== s.baseVersao || a.atualizadoEm > s.baseAtualizadoEm),
  }
})

const artigo = {
  id: 'a1',
  titulo: 'Anexos',
  versao: 2,
  atualizadoEm: 100,
  publico: 'usuario',
  conteudo: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'antigo' }] },
    ],
  },
} as unknown as Article

const sugestao = (extra: Partial<Suggestion> = {}): Suggestion =>
  ({
    id: 's1',
    articleId: 'a1',
    titulo: 'Anexos',
    conteudo: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'novo' }] },
      ],
    },
    diffResumo: ['Limite subiu para 10 MB'],
    motivo: 'o limite mudou',
    avisos: [],
    pratsDesatualizados: false,
    automatico: false,
    status: 'pending',
    origem: { tipo: 'regras-md', arquivo: 'regras/anexos.md', hash: 'h' },
    baseVersao: 2,
    baseAtualizadoEm: 100,
    modelo: 'm',
    criadoEm: 1,
    ...extra,
  }) as Suggestion

async function renderizar() {
  const { SuggestionReview } = await import('./SuggestionReview')
  render(
    <MemoryRouter initialEntries={['/admin/sugestoes/a1/s1']}>
      <Routes>
        <Route
          path="/admin/sugestoes/:articleId/:suggestionId"
          element={<SuggestionReview />}
        />
        <Route path="/admin/sugestoes" element={<p>fila</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getArticle.mockResolvedValue(artigo)
  getSuggestion.mockResolvedValue(sugestao())
  publishArticle.mockResolvedValue(3)
})

describe('SuggestionReview', () => {
  it('mostra a versão atual e a sugestão lado a lado, com o resumo das mudanças', async () => {
    await renderizar()
    expect(
      await screen.findByText('Limite subiu para 10 MB'),
    ).toBeInTheDocument()
    const blocos = screen.getAllByTestId('conteudo')
    expect(blocos[0]).toHaveTextContent('antigo')
    expect(blocos[1]).toHaveTextContent('novo')
    expect(screen.queryByText(/foi alterado depois/i)).toBeNull()
  })

  it('aprovar publica o conteúdo da sugestão ligado ao id dela', async () => {
    await renderizar()
    fireEvent.click(
      await screen.findByRole('button', { name: /aprovar e publicar/i }),
    )
    await waitFor(() => expect(publishArticle).toHaveBeenCalled())
    const [art, draft, uid, sid] = publishArticle.mock.calls[0] as [
      Article,
      { conteudo: unknown },
      string,
      string,
    ]
    expect(art.id).toBe('a1')
    expect(JSON.stringify(draft.conteudo)).toContain('novo')
    expect([uid, sid]).toEqual(['admin1', 's1'])
    expect(await screen.findByText('fila')).toBeInTheDocument()
  })

  it('avisa quando o artigo mudou depois que a IA o leu', async () => {
    getArticle.mockResolvedValue({ ...artigo, atualizadoEm: 500 })
    await renderizar()
    expect(
      await screen.findByText(/foi alterado depois que a ia o leu/i),
    ).toBeInTheDocument()
  })

  it('mostra alertas de prints e avisos de revisão', async () => {
    getSuggestion.mockResolvedValue(
      sugestao({
        pratsDesatualizados: true,
        avisos: ['a imagem foi removida da sugestão: x.png'],
      }),
    )
    await renderizar()
    expect(
      await screen.findByText(/prints deste artigo podem estar/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/imagem foi removida/i)).toBeInTheDocument()
  })

  it('explica que a sugestão de textos alternativos não muda o que se vê', async () => {
    getSuggestion.mockResolvedValue(
      sugestao({
        origem: {
          tipo: 'alt-texto',
          arquivo: 'Textos alternativos (IA)',
          hash: 'h',
        },
        diffResumo: ['Imagem 1: “Imagem 1 do artigo "X"” → “Tela de login”'],
      }),
    )
    await renderizar()
    expect(
      await screen.findByText(/só troca textos alternativos/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Tela de login/)).toBeInTheDocument()
  })

  it('sugestão já decidida não oferece ações', async () => {
    getSuggestion.mockResolvedValue(sugestao({ status: 'discarded' }))
    await renderizar()
    expect(await screen.findByText(/já foi descartada/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /aprovar/i })).toBeNull()
  })

  it('descartar chama o serviço depois da confirmação', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await renderizar()
    fireEvent.click(await screen.findByRole('button', { name: /descartar/i }))
    await waitFor(() =>
      expect(discardSuggestion).toHaveBeenCalledWith('a1', 's1', 'admin1'),
    )
  })
})
