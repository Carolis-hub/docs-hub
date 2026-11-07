import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Block } from '../../types/content'
import { RevisaoPage } from './RevisaoPage'

const listArticlesByStatus = vi.fn()
const listArticlesByRevisaoStatus = vi.fn()
const listArticlesByFlag = vi.fn()
const clearFlag = vi.fn()
const listAllBlocks = vi.fn()
const aprovarEPublicar = vi.fn()
const transitar = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin', email: 'a@x.com' },
    profile: { nome: 'Ana' },
    isAdmin: true,
  }),
}))
vi.mock('../../services/articles', () => ({
  listArticlesByStatus: (...a: unknown[]) => listArticlesByStatus(...a),
  listArticlesByRevisaoStatus: (...a: unknown[]) =>
    listArticlesByRevisaoStatus(...a),
  listArticlesByFlag: (...a: unknown[]) => listArticlesByFlag(...a),
  clearFlag: (...a: unknown[]) => clearFlag(...a),
}))
vi.mock('../../services/governanca', () => ({
  aprovarEPublicar: (...a: unknown[]) => aprovarEPublicar(...a),
  transitar: (...a: unknown[]) => transitar(...a),
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
    versao: 0,
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
  listArticlesByStatus.mockImplementation(async (status: string) =>
    status === 'review'
      ? [
          artigo('1', 'Como excluir anexos?'),
          artigo('2', 'Como adicionar anexos?', { origem: { tipo: 'editor' } }),
        ]
      : [],
  )
  listArticlesByRevisaoStatus.mockResolvedValue([])
  listArticlesByFlag.mockResolvedValue([])
  aprovarEPublicar.mockResolvedValue({ versao: 1 })
  transitar.mockResolvedValue({ versao: 1 })
  clearFlag.mockResolvedValue(undefined)
})

describe('RevisaoPage', () => {
  it('lista os itens em revisão com caminho e origem', async () => {
    abrir()
    expect(await screen.findByText('Como excluir anexos?')).toBeInTheDocument()
    expect(listArticlesByStatus).toHaveBeenCalledWith('review')
    expect(listArticlesByRevisaoStatus).toHaveBeenCalledWith('review')
    expect(screen.getAllByText('SmartShare 4 › Anexos')).toHaveLength(2)
    expect(screen.getAllByText('Importado')).toHaveLength(1)
    expect(screen.getByText(/2 itens aguardando revisão/)).toBeInTheDocument()
  })

  it('avisa quando a fila está vazia', async () => {
    listArticlesByStatus.mockResolvedValue([])
    abrir()
    expect(await screen.findByText(/Nenhum artigo na fila/)).toBeInTheDocument()
  })

  it('"Aprovar e publicar" aprova e publica pelo serviço de governança', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Aprovar e publicar' })[0]!,
    )
    await waitFor(() => expect(aprovarEPublicar).toHaveBeenCalledTimes(1))
    expect(aprovarEPublicar).toHaveBeenCalledWith('1', 'admin', {
      autorNome: 'Ana',
    })
    expect(await screen.findByText(/1 artigo publicado\./)).toBeInTheDocument()
  })

  it('"Aprovar" só aprova, sem publicar', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getAllByRole('button', { name: 'Aprovar' })[0]!)
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith('1', 'aprovar', 'admin', {
        autorNome: 'Ana',
      }),
    )
    expect(aprovarEPublicar).not.toHaveBeenCalled()
    expect(await screen.findByText(/espera a publicação/)).toBeInTheDocument()
  })

  it('aprova só os selecionados e relata os que falharam', async () => {
    aprovarEPublicar.mockRejectedValueOnce(
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
    await waitFor(() => expect(aprovarEPublicar).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText(
        /Como excluir anexos\?: imagem sem texto alternativo/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 artigo publicado\./)).toBeInTheDocument()
  })

  it('devolver volta o item para rascunho', async () => {
    abrir()
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getAllByRole('button', { name: 'Devolver' })[1]!)
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith('2', 'reabrir', 'admin'),
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

  it('a alteração pendente de um artigo publicado entra na fila com o selo da versão no ar', async () => {
    listArticlesByRevisaoStatus.mockImplementation(async (status: string) =>
      status === 'review'
        ? [
            artigo('9', 'Artigo no ar', {
              status: 'published',
              versao: 3,
              origem: { tipo: 'editor' },
            }),
          ]
        : [],
    )
    abrir()
    expect(await screen.findByText('Artigo no ar')).toBeInTheDocument()
    expect(
      screen.getByText('Alteração do artigo publicado (v3)'),
    ).toBeInTheDocument()
  })

  it('aprovados esperam a publicação numa seção própria', async () => {
    listArticlesByStatus.mockImplementation(async (status: string) =>
      status === 'approved'
        ? [artigo('7', 'Pronto para sair', { status: 'approved' })]
        : [],
    )
    abrir()
    const secao = await screen.findByRole('region', { name: 'Aprovados' })
    expect(within(secao).getByText('Pronto para sair')).toBeInTheDocument()
    fireEvent.click(within(secao).getByRole('button', { name: 'Publicar' }))
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith('7', 'publicar', 'admin', {
        autorNome: 'Ana',
      }),
    )
    expect(
      await screen.findByText(/publicado \(versão 1\)/),
    ).toBeInTheDocument()
  })

  it('mostra os artigos cujo arquivo sumiu da origem e deixa despublicar ou manter', async () => {
    listArticlesByFlag.mockResolvedValue([
      artigo('9', 'Guia antigo', {
        status: 'published',
        origem: { tipo: 'importacao', arquivo: 'guias/antigo.md' },
        flags: ['origem_removida'],
      }),
    ])
    abrir()
    expect(await screen.findByText('Guia antigo')).toBeInTheDocument()
    expect(listArticlesByFlag).toHaveBeenCalledWith('origem_removida')
    expect(screen.getByText(/guias\/antigo\.md/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Despublicar' }))
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith('9', 'despublicar', 'admin'),
    )
    await waitFor(() =>
      expect(clearFlag).toHaveBeenCalledWith('9', 'origem_removida', 'admin'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Manter' }))
    await waitFor(() => expect(clearFlag).toHaveBeenCalledTimes(2))
    expect(transitar).toHaveBeenCalledTimes(1)
  })

  it('mostra o arquivo de origem e o aviso de classificação automática', async () => {
    listArticlesByStatus.mockImplementation(async (status: string) =>
      status === 'review'
        ? [
            artigo('1', 'Configurar e-mail', {
              origem: {
                tipo: 'importacao',
                arquivo: 'config/email.md',
                classificacao: {
                  conteudo: 'funcional',
                  confianca: 'media',
                  categoria: 'configuracoes',
                  publico: 'usuario',
                  motivos: [],
                },
              },
            }),
          ]
        : [],
    )
    abrir()
    expect(await screen.findByText(/config\/email\.md/)).toBeInTheDocument()
    expect(screen.getByText(/sugeridos automaticamente/)).toBeInTheDocument()
  })
})
