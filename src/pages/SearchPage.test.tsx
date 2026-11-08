import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block, Unidade } from '../types/content'
import type { IndexedItem } from '../types/search'
import { criarMotor } from '../utils/searchEngine'
import { SearchPage } from './SearchPage'

const useSearchEngine = vi.fn()
const listProductTree = vi.fn()

vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => useSearchEngine(),
}))
vi.mock('../services/blocks', () => ({
  listProductTree: (...a: unknown[]) => listProductTree(...a),
}))
vi.mock('../services/search', () => ({ registrarBuscaSemResultado: vi.fn() }))

const bloco = (
  id: string,
  nome: string,
  parentId: string | null,
  productId: string,
  extra = {},
): Block => ({
  id,
  nome,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId,
  ...extra,
})
const unidade = (id: string, nome: string): Unidade => ({
  id,
  nome,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
})
const item = (
  id: string,
  titulo: string,
  extra: Partial<IndexedItem> = {},
): IndexedItem => ({
  id,
  titulo,
  resumo: `Resumo de ${titulo}`,
  textoPlano: `${titulo} sobre relatórios e envio`,
  blockId: 'p1',
  publico: 'usuario',
  productId: 'p1',
  ...extra,
})

const itens = [
  item('a1', 'Configurar envio', {
    categoria: 'configuracoes',
    blockId: 'anexos',
  }),
  item('a2', 'Fluxo de aprovação', { categoria: 'processos', blockId: 'dash' }),
  item('a3', 'Relatório mensal', { blockId: 'p1' }),
  item('b1', 'Regras do DI', {
    productId: 'p2',
    blockId: 'p2',
    categoria: 'regras-de-negocio',
  }),
  item('c1', 'Guia solto', { productId: 'p3', blockId: 'p3' }),
]
const produtos = [
  bloco('p1', 'SmartShare 4', null, 'p1', { unidadeId: 'u1' }),
  bloco('p2', 'SmartShare DI', null, 'p2', { unidadeId: 'u1' }),
  bloco('p3', 'Outro produto', null, 'p3'),
]
const arvoreP1 = [
  produtos[0]!,
  bloco('anexos', 'Anexos', 'p1', 'p1'),
  bloco('dash', 'Dashboard', 'p1', 'p1'),
]

function abrir(url = '/busca') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <SearchPage />
    </MemoryRouter>,
  )
}
const titulos = () =>
  screen
    .getAllByRole('link')
    .filter((l) => l.getAttribute('href')?.startsWith('/a/'))
    .map((l) => l.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  useSearchEngine.mockReturnValue({
    dados: {
      produtos,
      unidades: [unidade('u1', 'Process Solution')],
      motor: criarMotor(itens, true),
    },
    erro: null,
    carregando: false,
  })
  listProductTree.mockImplementation(async (id: string) =>
    id === 'p1' ? arvoreP1 : [],
  )
})

describe('SearchPage', () => {
  it('sem texto nem filtro, convida a buscar e aponta para as categorias', () => {
    abrir()
    expect(
      screen.getByText(/Digite para buscar em 5 artigos/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ver por categoria' }),
    ).toHaveAttribute('href', '/categorias')
  })

  it('só com um filtro lista os artigos (navegação), de A a Z', () => {
    abrir('/busca?categoria=processos')
    expect(titulos()).toEqual(['Fluxo de aprovação'])
    expect(screen.getByText('1 artigo')).toBeInTheDocument()
  })

  it('busca com texto e filtro de categoria juntos', () => {
    abrir('/busca?q=relat%C3%B3rios&categoria=configuracoes')
    expect(titulos()).toEqual(['Configurar envio'])
  })

  it('filtrar por unidade restringe os produtos oferecidos e os resultados', () => {
    abrir('/busca?unidade=u1&categoria=regras-de-negocio')
    expect(titulos()).toEqual(['Regras do DI'])
    const produtosSelect = screen.getByLabelText('Filtrar por produto')
    expect(
      within(produtosSelect)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os produtos', 'SmartShare 4', 'SmartShare DI'])
  })

  it('"Sem unidade" mostra só os produtos soltos', () => {
    abrir('/busca?unidade=sem-unidade&categoria=')
    expect(titulos()).toEqual(['Guia solto'])
  })

  it('escolher um produto libera o filtro de subproduto, que filtra pelos blocos dele', async () => {
    abrir()
    expect(screen.queryByLabelText('Filtrar por subproduto')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filtrar por produto'), {
      target: { value: 'p1' },
    })
    const sub = await screen.findByLabelText('Filtrar por subproduto')
    expect(
      within(sub)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os subprodutos', 'Anexos', 'Dashboard'])
    await waitFor(() => expect(titulos()).toHaveLength(3))
    fireEvent.change(sub, { target: { value: 'dash' } })
    await waitFor(() => expect(titulos()).toEqual(['Fluxo de aprovação']))
    // O caminho do resultado mostra a unidade, o produto e o subproduto.
    expect(
      screen.getByText('Process Solution › SmartShare 4 › Dashboard'),
    ).toBeInTheDocument()
  })

  it('filtra por módulo (nível abaixo do subproduto) e mostra o caminho completo', async () => {
    const comModulo = [
      ...itens,
      item('m1', 'Enviar anexo grande', { blockId: 'upload' }),
    ]
    useSearchEngine.mockReturnValue({
      dados: {
        produtos,
        unidades: [unidade('u1', 'Process Solution')],
        motor: criarMotor(comModulo, true),
      },
      erro: null,
      carregando: false,
    })
    listProductTree.mockResolvedValue([
      ...arvoreP1,
      bloco('upload', 'Upload', 'anexos', 'p1'),
    ])
    abrir('/busca?produto=p1&subproduto=anexos')
    const mod = await screen.findByLabelText('Filtrar por módulo')
    expect(
      within(mod)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os módulos', 'Upload'])
    fireEvent.change(mod, { target: { value: 'upload' } })
    await waitFor(() => expect(titulos()).toEqual(['Enviar anexo grande']))
    expect(
      screen.getByText('Process Solution › SmartShare 4 › Anexos › Upload'),
    ).toBeInTheDocument()
  })

  it('trocar de unidade zera produto e subproduto, e "Limpar filtros" volta ao início', async () => {
    abrir('/busca?produto=p1&subproduto=dash')
    await screen.findByLabelText('Filtrar por subproduto')
    fireEvent.change(screen.getByLabelText('Filtrar por unidade de negócio'), {
      target: { value: 'u1' },
    })
    expect(
      (screen.getByLabelText('Filtrar por produto') as HTMLSelectElement).value,
    ).toBe('')
    expect(screen.queryByLabelText('Filtrar por subproduto')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText(/Digite para buscar/)).toBeInTheDocument()
  })

  it('avisa quando os filtros não encontram nada', () => {
    abrir('/busca?produto=p2&categoria=processos')
    expect(
      screen.getByText('Nenhum artigo com esses filtros.'),
    ).toBeInTheDocument()
  })

  it('o filtro de unidade some quando não há unidades cadastradas', () => {
    useSearchEngine.mockReturnValue({
      dados: { produtos, unidades: [], motor: criarMotor(itens, true) },
      erro: null,
      carregando: false,
    })
    abrir()
    expect(screen.queryByLabelText('Filtrar por unidade de negócio')).toBeNull()
  })
})
