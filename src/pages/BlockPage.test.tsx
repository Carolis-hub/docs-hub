import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Article, Block } from '../types/content'

const useAuth = vi.fn()
const getBlock = vi.fn()
const listChildren = vi.fn()
const getAncestors = vi.fn()
const listArticlesByBlock = vi.fn()
const listProductTree = vi.fn()
const contarArtigosPorBlocos = vi.fn()

vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))
vi.mock('../services/blocks', () => ({
  getBlock: (...a: unknown[]) => getBlock(...a),
  listChildren: (...a: unknown[]) => listChildren(...a),
  getAncestors: (...a: unknown[]) => getAncestors(...a),
  listProductTree: (...a: unknown[]) => listProductTree(...a),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  salvarDescricao: vi.fn(),
  salvarFicha: vi.fn(),
  salvarRodape: vi.fn(),
}))
vi.mock('../services/unidades', () => ({
  getUnidade: vi.fn(async () => null),
  listUnidades: vi.fn(async () => []),
}))
vi.mock('../services/visaoGeral', () => ({
  contarArtigosPorBlocos: (...a: unknown[]) => contarArtigosPorBlocos(...a),
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
const artigo = (
  id: string,
  titulo: string,
  resumo = '',
  categoria = '',
): Article =>
  ({
    id,
    categoria,
    titulo,
    resumo,
    textoPlano: resumo,
    views: id === '3' ? 50 : Number(id),
    atualizadoEm: 0,
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
  listProductTree.mockResolvedValue([
    produto,
    anexos,
    bloco('dash', 'Dashboard', 'p'),
    bloco('acesso', 'Acesso', 'p'),
    bloco('upload', 'Upload', 'anexos'),
  ])
  contarArtigosPorBlocos.mockResolvedValue(2)
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
      await screen.findByText('Produto · 3 subprodutos · 6 artigos publicados'),
    ).toBeInTheDocument()
    // chip do módulo dentro do cartão do subproduto e o resumo do cartão
    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      '/b/upload',
    )
    expect(screen.getAllByText('2 artigos').length).toBeGreaterThan(0)
    expect(screen.getByText('1 módulo · 2 artigos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Anexos' })).toHaveAttribute(
      'href',
      '/b/anexos',
    )
    expect(
      screen.getByRole('button', { name: 'Editar Anexos' }),
    ).toBeInTheDocument()
    // um botão no cabeçalho e o cartão tracejado no fim da grade
    expect(
      screen.getAllByRole('button', { name: /novo subproduto/i }),
    ).toHaveLength(2)
  })

  it('produto: mostra a descrição e as informações do produto', async () => {
    getBlock.mockImplementation(async (id: string) =>
      id === 'p'
        ? {
            ...produto,
            descricao: 'Plataforma de gestão de documentos.',
            ficha: {
              secoes: [
                {
                  id: 'compatibilidade-di',
                  tipo: 'tabela',
                  titulo: 'Compatibilidade DI',
                  texto: 'Mantenha sempre o produto atualizado.',
                  colunas: ['SmartShare', 'DI Client'],
                  linhas: [['3.85.23', '3.85.19']],
                },
              ],
            },
          }
        : anexos,
    )
    await abrir('p')
    expect(
      await screen.findByText('Plataforma de gestão de documentos.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Compatibilidade DI' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Editar informações/ }),
    ).toBeInTheDocument()
  })

  it('produto sem nada salvo: as 5 opções fixas já aparecem, para admin e leitor', async () => {
    const nomes = [
      'Compatibilidade DI',
      'Compatibilidade SmartShare',
      'Instaladores e Aplicativos',
      'Release Notes',
      'Contato',
    ]
    await abrir('p')
    const admin = await screen.findAllByRole('tab')
    expect(admin.map((o) => o.textContent)).toEqual(nomes)
    cleanup()
    useAuth.mockReturnValue({ user: { uid: 'l' }, isAdmin: false })
    await abrir('p')
    const leitor = await screen.findAllByRole('tab')
    expect(leitor.map((o) => o.textContent)).toEqual(nomes)
  })

  it('leitor não vê a edição das informações do produto', async () => {
    useAuth.mockReturnValue({ user: { uid: 'l' }, isAdmin: false })
    await abrir('p')
    await screen.findByText('Dashboard')
    expect(screen.queryByText(/Informações do produto/)).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Editar informações/ }),
    ).toBeNull()
  })

  it('produto: as 5 opções ficam abaixo dos subprodutos', async () => {
    await abrir('p')
    const subprodutos = await screen.findByRole('region', {
      name: 'Subprodutos',
    })
    const opcoes = screen.getByRole('region', {
      name: 'Informações do produto',
    })
    expect(
      subprodutos.compareDocumentPosition(opcoes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const descricao = screen.getByRole('region', {
      name: 'Descrição do produto',
    })
    expect(
      descricao.compareDocumentPosition(subprodutos) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('filtra as seções sem acento nem caixa', async () => {
    await abrir('p')
    await screen.findByText('Dashboard')
    fireEvent.change(screen.getByLabelText('Filtrar subprodutos'), {
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
    expect(screen.queryByText('Seções')).toBeNull()
  })

  it('artigos: ordena por título e por visualizações e filtra', async () => {
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    const titulos = () =>
      within(screen.getByRole('region', { name: 'Artigos' }))
        .getAllByRole('link')
        .map((l) => l.textContent ?? '')
    fireEvent.change(screen.getByLabelText('Ordenar'), {
      target: { value: 'titulo' },
    })
    expect(titulos()[0]).toContain('Como adicionar anexos?')
    expect(titulos()[1]).toContain('Como compartilhar?')
    expect(titulos()[2]).toContain('Como excluir anexos?')
    fireEvent.change(screen.getByLabelText('Ordenar'), {
      target: { value: 'acessados' },
    })
    expect(titulos()[0]).toContain('Como compartilhar?')
    fireEvent.change(screen.getByLabelText('Filtrar neste bloco'), {
      target: { value: 'compartilhar' },
    })
    expect(titulos()).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Filtrar neste bloco'), {
      target: { value: 'zzz' },
    })
    expect(
      screen.getByText('Nenhum artigo corresponde aos filtros.'),
    ).toBeInTheDocument()
  })

  it('filtra os artigos por categoria', async () => {
    listArticlesByBlock.mockResolvedValue([
      artigo('1', 'Como excluir anexos?', '', 'processos'),
      artigo('2', 'Como adicionar anexos?', '', 'configuracoes'),
      artigo('3', 'Sem categoria'),
    ])
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    fireEvent.click(screen.getByRole('button', { name: /^Processos/ }))
    const regiao = within(screen.getByRole('region', { name: 'Artigos' }))
    expect(regiao.getAllByRole('link')).toHaveLength(1)
    expect(regiao.getByText('Como excluir anexos?')).toBeInTheDocument()
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
    expect(screen.queryByText(/novo subproduto/i)).toBeNull()
  })

  it('admin acha o rodapé na página do produto, no cabeçalho e no fim da página', async () => {
    await abrir('p')
    await screen.findByText('Dashboard')
    // Produto sem rodapé: o convite aparece no fim da página.
    expect(
      screen.getByRole('button', { name: /ainda não tem rodapé/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rodapé' }))
    expect(
      screen.getByRole('heading', { name: 'Rodapé do produto' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /ainda não tem rodapé/i }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.queryByRole('heading', { name: 'Rodapé do produto' }),
    ).toBeNull()
  })

  it('subproduto não tem configuração de rodapé; leitor também não', async () => {
    await abrir('anexos')
    await screen.findByText('Como excluir anexos?')
    expect(screen.queryByRole('button', { name: 'Rodapé' })).toBeNull()
    useAuth.mockReturnValue({ user: { uid: 'l' }, isAdmin: false })
    await abrir('p')
    await screen.findByText('Dashboard')
    expect(screen.queryByRole('button', { name: 'Rodapé' })).toBeNull()
  })
})
