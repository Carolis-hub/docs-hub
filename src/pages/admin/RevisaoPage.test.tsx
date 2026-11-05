import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Block } from '../../types/content'
import { RevisaoPage } from './RevisaoPage'

const listArticlesByStatus = vi.fn()
const listAllBlocks = vi.fn()
const publishArticle = vi.fn()
const returnToDraft = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'admin' }, isAdmin: true }),
}))
vi.mock('../../services/articles', () => ({
  listArticlesByStatus: (...a: unknown[]) => listArticlesByStatus(...a),
  publishArticle: (...a: unknown[]) => publishArticle(...a),
  returnToDraft: (...a: unknown[]) => returnToDraft(...a),
}))
vi.mock('../../services/blocks', () => ({
  listAllBlocks: (...a: unknown[]) => listAllBlocks(...a),
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
const artigo = (id: string, titulo: string, extra = {}): Article =>
  ({
    id,
    titulo,
    blockId: 'anexos',
    productId: 'p',
    resumo: '',
    textoPlano: '',
    conteudo: { type: 'doc' },
    publico: 'usuario',
    status: 'review',
    origem: { tipo: 'importacao' },
    atualizadoEm: 1,
    ...extra,
  }) as Article

function abrir() {
  render(
    <MemoryRouter>
      <RevisaoPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listAllBlocks.mockResolvedValue([
    bloco('p', 'SmartShare 4', null),
    bloco('anexos', 'Anexos', 'p'),
  ])
  listArticlesByStatus.mockResolvedValue([
    artigo('1', 'Como excluir anexos?'),
    artigo('2', 'Como adicionar anexos?', { origem: { tipo: 'editor' } }),
  ])
  publishArticle.mockResolvedValue(1)
  returnToDraft.mockResolvedValue(undefined)
})

describe('RevisaoPage', () => {
  it('lista os artigos em revisão com caminho e origem', async () => {
    abrir()
    expect(await screen.findByText('Como excluir anexos?')).toBeInTheDocument()
    expect(listArticlesByStatus).toHaveBeenCalledWith('review')
    expect(screen.getAllByText('SmartShare 4 › Anexos')).toHaveLength(2)
    expect(screen.getAllByText('Importado')).toHaveLength(1)
    expect(
      screen.getByText(/2 artigos aguardando aprovação/),
    ).toBeInTheDocument()
  })

  it('avisa quando a fila está vazia', async () => {
    listArticlesByStatus.mockResolvedValue([])
    abrir()
    expect(await screen.findByText(/Nenhum artigo na fila/)).toBeInTheDocument()
  })

  it('aprova um artigo publicando-o com o conteúdo gravado', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]!)
    await waitFor(() => expect(publishArticle).toHaveBeenCalledTimes(1))
    const [a, rascunho, uid] = publishArticle.mock.calls[0]!
    expect(a.id).toBe('1')
    expect(rascunho).toMatchObject({ titulo: 'Como excluir anexos?' })
    expect(uid).toBe('admin')
    expect(await screen.findByText(/1 artigo publicado\./)).toBeInTheDocument()
  })

  it('aprova só os selecionados e relata os que falharam', async () => {
    publishArticle.mockRejectedValueOnce(
      new Error('imagem sem texto alternativo'),
    )
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getByLabelText('Selecionar todos'))
    fireEvent.click(
      screen.getByRole('button', {
        name: /aprovar e publicar selecionados \(2\)/i,
      }),
    )
    await waitFor(() => expect(publishArticle).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText(
        /Como excluir anexos\?: imagem sem texto alternativo/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 artigo publicado\./)).toBeInTheDocument()
  })

  it('devolve um artigo para rascunho', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getAllByRole('button', { name: 'Devolver' })[1]!)
    await waitFor(() =>
      expect(returnToDraft).toHaveBeenCalledWith('2', 'admin'),
    )
  })

  it('o botão de aprovar em lote fica desligado sem seleção', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    expect(
      screen.getByRole('button', {
        name: /aprovar e publicar selecionados \(0\)/i,
      }),
    ).toBeDisabled()
  })
})
