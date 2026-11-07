import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Revisao } from '../../types/content'
import { ArticleEditor } from './ArticleEditor'

const getArticle = vi.fn()
const getRevisao = vi.fn()
const salvarAlteracoes = vi.fn()
const transitar = vi.fn()
const descartarRevisao = vi.fn()
const adicionarComentario = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'admin', email: 'a@x.com' },
    profile: { nome: 'Ana' },
  }),
}))
vi.mock('../../components/editor/RichEditor', () => ({
  RichEditor: ({ onChange }: { onChange: (d: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'editado' }] },
          ],
        })
      }
    >
      editar texto
    </button>
  ),
}))
vi.mock('../../services/articles', () => ({
  getArticle: (...a: unknown[]) => getArticle(...a),
  listVersions: async () => [
    {
      versao: 2,
      titulo: 'T',
      conteudo: {},
      origem: 'manual',
      autorId: 'u1',
      criadoEm: 5,
      aprovadoPor: 'u2',
    },
  ],
  createArticle: vi.fn(),
  deleteArticle: vi.fn(),
  clearFlag: vi.fn(),
}))
vi.mock('../../services/governanca', () => ({
  getRevisao: (...a: unknown[]) => getRevisao(...a),
  salvarAlteracoes: (...a: unknown[]) => salvarAlteracoes(...a),
  transitar: (...a: unknown[]) => transitar(...a),
  descartarRevisao: (...a: unknown[]) => descartarRevisao(...a),
}))
vi.mock('../../services/comentarios', () => ({
  listarComentarios: async () => [
    {
      id: 'c1',
      tipo: 'reprovacao',
      texto: 'Falta o passo 3',
      autorId: 'u2',
      autorNome: 'Bruno',
      alvo: 'artigo',
      criadoEm: 1,
    },
  ],
  adicionarComentario: (...a: unknown[]) => adicionarComentario(...a),
}))
vi.mock('../../services/audit', () => ({
  listarAuditoriaDoArtigo: async () => [
    {
      id: 'a1',
      usuarioId: 'u1',
      acao: 'artigo.aprovar',
      alvo: 'articles/a1',
      data: 9,
      detalhe: 'nota',
    },
  ],
}))
vi.mock('../../services/users', () => ({
  listUsers: async () => [
    { uid: 'u1', nome: 'Ana' },
    { uid: 'u2', nome: 'Bruno' },
  ],
}))
vi.mock('../../services/suggestions', () => ({
  getSuggestion: vi.fn(async () => null),
}))
vi.mock('../../services/blocks', () => ({ getBlock: vi.fn() }))

const doc = (t: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
})
const artigo = (extra: Partial<Article> = {}): Article =>
  ({
    id: 'a1',
    titulo: 'Anexos',
    blockId: 'b',
    productId: 'p',
    conteudo: doc('original'),
    publico: 'usuario',
    categoria: '',
    status: 'draft',
    versao: 0,
    flags: [],
    ...extra,
  }) as Article

function abrir() {
  render(
    <MemoryRouter initialEntries={['/admin/artigos/a1/editar']}>
      <Routes>
        <Route
          path="/admin/artigos/:articleId/editar"
          element={<ArticleEditor />}
        />
      </Routes>
    </MemoryRouter>,
  )
}
const botao = (nome: string | RegExp) =>
  screen.getByRole('button', { name: nome })

beforeEach(() => {
  vi.clearAllMocks()
  getArticle.mockResolvedValue(artigo())
  getRevisao.mockResolvedValue(null)
  salvarAlteracoes.mockResolvedValue({ alvo: 'artigo' })
  transitar.mockResolvedValue({ versao: 3 })
  descartarRevisao.mockResolvedValue(undefined)
  adicionarComentario.mockResolvedValue(undefined)
})

describe('ArticleEditor: ciclo de vida', () => {
  it('rascunho: oferece enviar para revisão e arquivar, mas não publicar', async () => {
    abrir()
    await screen.findByText('Rascunho')
    expect(botao('Enviar para revisão')).toBeInTheDocument()
    expect(botao('Arquivar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
  })

  it('em revisão: aprovar, reprovar e voltar a rascunho', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'review' }))
    abrir()
    await screen.findByText('Em revisão')
    expect(botao('Aprovar')).toBeInTheDocument()
    expect(botao(/Reprovar/)).toBeInTheDocument()
    expect(botao('Voltar a rascunho')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull()
  })

  it('aprovado: só então aparece Publicar', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'approved' }))
    abrir()
    await screen.findByText('Aprovado')
    fireEvent.click(botao('Publicar'))
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith('a1', 'publicar', 'admin', {
        comentario: '',
        autorNome: 'Ana',
        sugestaoId: undefined,
      }),
    )
    expect(await screen.findByText('Publicado (versão 3).')).toBeInTheDocument()
  })

  it('reprovar sem comentário é barrado na tela; com comentário envia', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'review' }))
    abrir()
    await screen.findByText('Em revisão')
    fireEvent.click(botao(/Reprovar/))
    expect(
      await screen.findByText(/Explique o que precisa ser ajustado/),
    ).toBeInTheDocument()
    expect(transitar).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Comentário da revisão'), {
      target: { value: 'Refazer o passo 2' },
    })
    fireEvent.click(botao(/Reprovar/))
    await waitFor(() =>
      expect(transitar).toHaveBeenCalledWith(
        'a1',
        'reprovar',
        'admin',
        expect.objectContaining({ comentario: 'Refazer o passo 2' }),
      ),
    )
  })

  it('aprovar com texto editado e não salvo salva antes', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'review' }))
    abrir()
    await screen.findByText('Em revisão')
    fireEvent.click(botao('editar texto'))
    fireEvent.click(botao('Aprovar'))
    await waitFor(() => expect(transitar).toHaveBeenCalled())
    expect(salvarAlteracoes).toHaveBeenCalledTimes(1)
    expect(salvarAlteracoes.mock.invocationCallOrder[0]!).toBeLessThan(
      transitar.mock.invocationCallOrder[0]!,
    )
  })

  it('publicar com edição não salva num aprovado manda salvar antes (a aprovação seria anulada)', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'approved' }))
    abrir()
    await screen.findByText('Aprovado')
    fireEvent.click(botao('editar texto'))
    fireEvent.click(botao('Publicar'))
    expect(
      await screen.findByText(/Há alterações não salvas/),
    ).toBeInTheDocument()
    expect(transitar).not.toHaveBeenCalled()
    expect(salvarAlteracoes).not.toHaveBeenCalled()
  })

  it('o botão Salvar só liga depois de uma edição', async () => {
    abrir()
    await screen.findByText('Rascunho')
    expect(botao('Salvar')).toBeDisabled()
    fireEvent.click(botao('editar texto'))
    expect(botao('Salvar')).toBeEnabled()
    fireEvent.click(botao('Salvar'))
    await waitFor(() => expect(salvarAlteracoes).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument()
  })

  it('mostra comentários da revisão, histórico com aprovador e a trilha com nomes', async () => {
    abrir()
    expect(await screen.findByText('Falta o passo 3')).toBeInTheDocument()
    expect(screen.getByText('Reprovação')).toBeInTheDocument()
    expect(screen.getByText(/aprovada por Bruno/)).toBeInTheDocument()
    expect(screen.getByText(/Aprovou/)).toBeInTheDocument()
    expect(screen.getByText('(nota)')).toBeInTheDocument()
  })

  it('"Só comentar" registra o comentário sem mudar o estado', async () => {
    abrir()
    await screen.findByText('Rascunho')
    expect(botao('Só comentar')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Comentário da revisão'), {
      target: { value: 'Conferir os prints' },
    })
    fireEvent.click(botao('Só comentar'))
    await waitFor(() =>
      expect(adicionarComentario).toHaveBeenCalledWith(
        'a1',
        { texto: 'Conferir os prints', alvo: 'artigo' },
        'admin',
        'Ana',
      ),
    )
    expect(transitar).not.toHaveBeenCalled()
  })
})

describe('ArticleEditor: artigo publicado', () => {
  it('avisa que editar cria uma alteração pendente e oferece despublicar/arquivar', async () => {
    getArticle.mockResolvedValue(artigo({ status: 'published', versao: 2 }))
    abrir()
    await screen.findByText('Publicado v2')
    expect(
      screen.getByText(/alteração pendente/, { selector: 'strong' }),
    ).toBeInTheDocument()
    expect(botao('Despublicar')).toBeInTheDocument()
    expect(botao('Arquivar')).toBeInTheDocument()
    fireEvent.click(botao('editar texto'))
    expect(botao('Salvar como alteração pendente')).toBeEnabled()
    fireEvent.click(botao('Salvar como alteração pendente'))
    await waitFor(() => expect(salvarAlteracoes).toHaveBeenCalled())
  })

  it('com alteração pendente: edita a alteração, as ações valem para ela e dá para descartar', async () => {
    getArticle.mockResolvedValue(
      artigo({
        status: 'published',
        versao: 2,
        revisao: { status: 'draft', autorId: 'u1', atualizadoEm: 1 },
      }),
    )
    getRevisao.mockResolvedValue({
      titulo: 'Anexos (novo)',
      conteudo: doc('texto novo'),
      publico: 'usuario',
      status: 'draft',
    } as Revisao)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    abrir()
    expect(
      await screen.findByText('Alteração pendente: Rascunho'),
    ).toBeInTheDocument()
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(
      'Anexos (novo)',
    )
    expect(screen.getByText(/A versão 2 continua no ar/)).toBeInTheDocument()
    // Despublicar/arquivar não valem com alteração pendente.
    expect(screen.queryByRole('button', { name: 'Despublicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
    expect(botao('Enviar para revisão')).toBeInTheDocument()

    fireEvent.click(botao('Descartar alteração'))
    await waitFor(() =>
      expect(descartarRevisao).toHaveBeenCalledWith('a1', 'admin'),
    )
  })
})

describe('ArticleEditor: artigo novo com modelos', () => {
  function abrirNovo(consulta = '?blockId=b1') {
    render(
      <MemoryRouter initialEntries={[`/admin/artigos/novo${consulta}`]}>
        <Routes>
          <Route path="/admin/artigos/novo" element={<ArticleEditor />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('pede para escolher um modelo antes de abrir o editor', async () => {
    abrirNovo()
    const lista = await screen.findByRole('list', {
      name: 'Modelos de documento',
    })
    expect(within(lista).getAllByRole('button')).toHaveLength(5)
    expect(within(lista).getByText('Em branco')).toBeInTheDocument()
    expect(within(lista).getByText('Regra de negócio')).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).toBeNull()
  })

  it('escolher um modelo abre o editor com a categoria e os trechos a preencher', async () => {
    abrirNovo()
    fireEvent.click(await screen.findByRole('button', { name: /Processo/ }))
    expect(
      (await screen.findByLabelText('Categoria')) as HTMLSelectElement,
    ).toHaveValue('processos')
    expect(screen.getByLabelText('Título')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('Como'),
    )
    expect(
      await screen.findByText(/Ainda há \d+ trechos do modelo para preencher/),
    ).toBeInTheDocument()
    expect(botao('Criar rascunho')).toBeInTheDocument()
  })

  it('o modelo em branco não traz categoria nem aviso', async () => {
    abrirNovo()
    fireEvent.click(await screen.findByRole('button', { name: /Em branco/ }))
    expect(await screen.findByLabelText('Categoria')).toHaveValue('')
    expect(screen.queryByText(/trechos? do modelo/)).toBeNull()
  })

  it('?modelo= pula a escolha', async () => {
    abrirNovo('?blockId=b1&modelo=configuracao')
    expect(await screen.findByLabelText('Categoria')).toHaveValue(
      'configuracoes',
    )
    expect(
      screen.queryByRole('list', { name: 'Modelos de documento' }),
    ).toBeNull()
  })

  it('o aviso some quando o texto do modelo é substituído', async () => {
    abrirNovo('?blockId=b1&modelo=funcionalidade')
    await screen.findByText(/trechos do modelo para preencher/)
    fireEvent.click(botao('editar texto'))
    await waitFor(() =>
      expect(screen.queryByText(/trechos? do modelo/)).toBeNull(),
    )
  })
})
