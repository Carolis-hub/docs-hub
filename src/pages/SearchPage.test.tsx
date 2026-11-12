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
import { definirProdutoEmContexto } from '../hooks/useProdutoEmContexto'
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
const registrarBuscaSemResultado = vi.fn()
const registrarRetornoDaBusca = vi.fn()
vi.mock('../services/search', () => ({
  registrarBuscaSemResultado: (...a: unknown[]) =>
    registrarBuscaSemResultado(...a),
  registrarRetornoDaBusca: (...a: unknown[]) => registrarRetornoDaBusca(...a),
  jaAvaliouBusca: () => false,
}))

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
  definirProdutoEmContexto('')
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
  it('sem produto definido, pede a escolha e não busca', () => {
    abrir('/busca?q=envio')
    expect(
      screen.getByText(/Escolha um produto para buscar/),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /Configurar envio/ })).toEqual(
      [],
    )
    expect(
      within(screen.getByLabelText('Produto da busca'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Escolha um produto',
      'SmartShare 4',
      'SmartShare DI',
      'Outro produto',
    ])
  })

  it('herda o produto em contexto (o da tela de onde a pessoa veio)', () => {
    definirProdutoEmContexto('p2')
    abrir('/busca?q=regras')
    expect(titulos()).toEqual(['Regras do DI'])
    expect(
      (screen.getByLabelText('Produto da busca') as HTMLSelectElement).value,
    ).toBe('p2')
  })

  it('quem só tem um produto nem precisa escolher', () => {
    useSearchEngine.mockReturnValue({
      dados: {
        produtos: [produtos[0]!],
        unidades: [],
        motor: criarMotor(itens, true),
      },
      erro: null,
      carregando: false,
    })
    abrir('/busca?q=configurar')
    expect(titulos()).toEqual(['Configurar envio'])
  })

  it('a busca nunca traz artigo de outro produto', () => {
    abrir('/busca?produto=p1&q=regras')
    expect(
      screen.getByText('Nenhum resultado para “regras”.'),
    ).toBeInTheDocument()
  })

  it('produto da URL que a pessoa não pode ver é ignorado', () => {
    abrir('/busca?produto=secreto&q=envio')
    expect(
      screen.getByText(/Escolha um produto para buscar/),
    ).toBeInTheDocument()
  })

  it('com produto e sem texto nem filtro, convida a buscar e aponta para as categorias', () => {
    abrir('/busca?produto=p1')
    expect(
      screen.getByText(/Digite para buscar em 3\s+artigos de SmartShare 4/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ver por categoria' }),
    ).toHaveAttribute('href', '/categorias')
  })

  it('só com um filtro lista os artigos (navegação), de A a Z', () => {
    abrir('/busca?produto=p1&categoria=processos')
    expect(titulos()).toEqual(['Fluxo de aprovação'])
    expect(screen.getByText('1 artigo')).toBeInTheDocument()
  })

  it('busca com texto e filtro de categoria juntos', () => {
    abrir('/busca?produto=p1&q=relat%C3%B3rios&categoria=configuracoes')
    expect(titulos()).toEqual(['Configurar envio'])
  })

  it('filtrar por unidade restringe os produtos oferecidos', () => {
    abrir('/busca?unidade=u1&produto=p2&categoria=regras-de-negocio')
    expect(titulos()).toEqual(['Regras do DI'])
    expect(
      within(screen.getByLabelText('Produto da busca'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['SmartShare 4', 'SmartShare DI'])
  })

  it('trocar de unidade mantém o produto que é dela e troca o que não é', async () => {
    abrir('/busca?produto=p1&q=guia')
    const unidadeSelect = screen.getByLabelText(
      'Filtrar por unidade de negócio',
    )
    fireEvent.change(unidadeSelect, { target: { value: 'u1' } })
    expect(
      (screen.getByLabelText('Produto da busca') as HTMLSelectElement).value,
    ).toBe('p1')
    // "Sem unidade" só tem um produto: ele passa a ser o da busca.
    fireEvent.change(unidadeSelect, { target: { value: 'sem-unidade' } })
    await waitFor(() => expect(titulos()).toEqual(['Guia solto']))
  })

  it('unidade com vários produtos, nenhum deles o atual: pede a escolha', () => {
    abrir('/busca?produto=p3&q=guia')
    fireEvent.change(screen.getByLabelText('Filtrar por unidade de negócio'), {
      target: { value: 'u1' },
    })
    expect(
      screen.getByText(/Escolha um produto para buscar/),
    ).toBeInTheDocument()
  })

  it('escolher um produto libera o filtro de subproduto, que filtra pelos blocos dele', async () => {
    abrir()
    expect(screen.queryByLabelText('Filtrar por subproduto')).toBeNull()
    fireEvent.change(screen.getByLabelText('Produto da busca'), {
      target: { value: 'p1' },
    })
    const sub = await screen.findByLabelText('Filtrar por subproduto')
    expect(
      within(sub)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Todos os subprodutos', 'Anexos', 'Dashboard'])
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

  it('"Limpar filtros" tira os refinamentos e mantém o produto', async () => {
    abrir('/busca?produto=p1&subproduto=dash')
    await screen.findByLabelText('Filtrar por subproduto')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(screen.getByText(/Digite para buscar/)).toBeInTheDocument()
    expect(
      (screen.getByLabelText('Produto da busca') as HTMLSelectElement).value,
    ).toBe('p1')
  })

  it('aponta para a seção do artigo que respondeu e destaca o primeiro resultado', () => {
    const texto =
      'Visão geral do envio de documentos.\nPermissões\nSó o gestor aprova o envio.\nPrazos\nO prazo de aprovação é de dois dias.'
    useSearchEngine.mockReturnValue({
      dados: {
        produtos,
        unidades: [],
        motor: criarMotor(
          [
            item('s1', 'Aprovação de documentos', {
              textoPlano: texto,
              secoes: [
                { t: 'Permissões', i: texto.indexOf('Permissões') },
                { t: 'Prazos', i: texto.indexOf('Prazos') },
              ],
            }),
          ],
          true,
        ),
      },
      erro: null,
      carregando: false,
    })
    abrir('/busca?produto=p1&q=prazo')
    expect(screen.getByText('Resposta mais provável')).toBeInTheDocument()
    expect(screen.getByText('Seção: Prazos')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Abrir o artigo nesta seção' }),
    ).toHaveAttribute('href', '/a/s1?secao=Prazos')
  })

  it('artigo sem seções no índice continua apontando para o artigo', () => {
    abrir('/busca?produto=p1&q=configurar')
    expect(screen.queryByText('Resposta mais provável')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Configurar envio' }),
    ).toHaveAttribute('href', '/a/a1')
  })

  it('"Esta busca ajudou?" registra o voto do termo no produto, uma vez', () => {
    abrir('/busca?produto=p1&q=configurar')
    fireEvent.click(screen.getByRole('button', { name: 'Não' }))
    expect(registrarRetornoDaBusca).toHaveBeenCalledWith(
      'configurar',
      'p1',
      false,
    )
    expect(screen.getByText('Obrigado pela resposta.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sim' })).toBeNull()
  })

  it('sem texto (só navegando por filtro) não pergunta se ajudou', () => {
    abrir('/busca?produto=p1&categoria=processos')
    expect(screen.queryByText('Esta busca ajudou?')).toBeNull()
  })

  it('busca sem resultado é registrada com o produto', () => {
    abrir('/busca?produto=p1&q=inexistente')
    expect(registrarBuscaSemResultado).toHaveBeenCalledWith('inexistente', 'p1')
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
