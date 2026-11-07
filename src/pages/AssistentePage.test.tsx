import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RespostaAssistente } from '../types/assistente'
import { AssistentePage } from './AssistentePage'

const assistenteConfigurado = vi.fn()
const perguntar = vi.fn()
const avaliarResposta = vi.fn()
const useSearchEngine = vi.fn()
const listProductTree = vi.fn()

vi.mock('../services/assistente', () => ({
  assistenteConfigurado: () => assistenteConfigurado(),
  perguntar: (...a: unknown[]) => perguntar(...a),
  avaliarResposta: (...a: unknown[]) => avaliarResposta(...a),
}))
vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => useSearchEngine(),
}))
vi.mock('../services/blocks', () => ({
  listProductTree: (...a: unknown[]) => listProductTree(...a),
}))

const bloco = (
  id: string,
  nome: string,
  parentId: string | null,
  extra = {},
) => ({
  id,
  nome,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId: 'p1',
  ...extra,
})

const resposta = (
  extra: Partial<RespostaAssistente> = {},
): RespostaAssistente => ({
  logId: 'log1',
  encontrou: true,
  resposta: 'Abra **Configurações** [1].\n\n1. Passo um\n2. Passo dois',
  fontes: [
    {
      numero: 1,
      id: 'a1',
      titulo: 'Configurar e-mail',
      produto: 'SmartShare 4',
    },
  ],
  restantesHoje: 29,
  ...extra,
})

function abrir() {
  render(
    <MemoryRouter>
      <AssistentePage />
    </MemoryRouter>,
  )
}
const perguntarComTexto = async (texto: string) => {
  fireEvent.change(screen.getByLabelText('Sua pergunta'), {
    target: { value: texto },
  })
  fireEvent.click(screen.getByRole('button', { name: /perguntar/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  assistenteConfigurado.mockReturnValue(true)
  perguntar.mockResolvedValue(resposta())
  avaliarResposta.mockResolvedValue(undefined)
  listProductTree.mockImplementation(async (id: string) =>
    id === 'p1'
      ? [bloco('p1', 'SmartShare 4', null), bloco('s1', 'Anexos', 'p1')]
      : [],
  )
  useSearchEngine.mockReturnValue({
    dados: {
      produtos: [bloco('p1', 'SmartShare 4', null, { unidadeId: 'u1' })],
      unidades: [
        {
          id: 'u1',
          nome: 'Process Solution',
          slug: 'ps',
          descricao: '',
          icone: '',
          ordem: 0,
        },
      ],
      motor: {},
    },
  })
})

describe('AssistentePage', () => {
  it('avisa quando o servidor do assistente não foi configurado', () => {
    assistenteConfigurado.mockReturnValue(false)
    abrir()
    expect(screen.getByText(/ainda não foi configurado/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Sua pergunta')).toBeNull()
  })

  it('envia a pergunta e mostra a resposta com citação clicável, fontes e a cota restante', async () => {
    abrir()
    await perguntarComTexto('Como configuro o e-mail?')
    expect(await screen.findByText('Configurações')).toBeInTheDocument()
    expect(perguntar).toHaveBeenCalledWith({
      pergunta: 'Como configuro o e-mail?',
      historico: [],
      filtros: {},
    })
    const citacao = screen.getByRole('link', { name: '[1]' })
    expect(citacao).toHaveAttribute('href', '/a/a1')
    expect(
      screen.getAllByRole('link', { name: 'Configurar e-mail' })[0],
    ).toHaveAttribute('href', '/a/a1')
    expect(screen.getByText('Passo um')).toBeInTheDocument()
    expect(screen.getByText(/29 perguntas restantes hoje/)).toBeInTheDocument()
    // A caixa é limpa e a conversa continua com o histórico.
    expect(
      (screen.getByLabelText('Sua pergunta') as HTMLTextAreaElement).value,
    ).toBe('')
  })

  it('manda os filtros escolhidos e o histórico da conversa', async () => {
    abrir()
    fireEvent.change(screen.getByLabelText('Limitar por unidade de negócio'), {
      target: { value: 'u1' },
    })
    fireEvent.change(screen.getByLabelText('Limitar por produto'), {
      target: { value: 'p1' },
    })
    const sub = await screen.findByLabelText('Limitar por subproduto')
    fireEvent.change(sub, { target: { value: 's1' } })
    fireEvent.change(screen.getByLabelText('Limitar por categoria'), {
      target: { value: 'processos' },
    })

    await perguntarComTexto('primeira pergunta')
    await screen.findByText('Configurações')
    await perguntarComTexto('e depois?')
    await waitFor(() => expect(perguntar).toHaveBeenCalledTimes(2))
    expect(perguntar.mock.calls[0]![0].filtros).toEqual({
      unidadeId: 'u1',
      produtoId: 'p1',
      subprodutoId: 's1',
      categoria: 'processos',
    })
    expect(perguntar.mock.calls[1]![0].historico).toEqual([
      { papel: 'usuario', texto: 'primeira pergunta' },
      { papel: 'assistente', texto: expect.stringContaining('Configurações') },
    ])
  })

  it('avisa quando a documentação não tem a resposta', async () => {
    perguntar.mockResolvedValue(
      resposta({
        encontrou: false,
        resposta: 'Não encontrei nada.',
        fontes: [],
      }),
    )
    abrir()
    await perguntarComTexto('pergunta sem resposta')
    expect(
      await screen.findByText(/Não encontrei a resposta na documentação/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Fontes')).toBeNull()
  })

  it('mostra o erro (ex.: cota) e deixa tentar de novo', async () => {
    perguntar.mockRejectedValueOnce(
      new Error('Você já fez as 30 perguntas permitidas por dia.'),
    )
    abrir()
    await perguntarComTexto('qualquer pergunta')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '30 perguntas permitidas',
    )
    expect(screen.getByRole('button', { name: /perguntar/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Sua pergunta'), {
      target: { value: 'de novo' },
    })
    expect(screen.getByRole('button', { name: /perguntar/i })).toBeEnabled()
  })

  it('a avaliação vai para a resposta certa e some depois de dada', async () => {
    abrir()
    await perguntarComTexto('Como configuro o e-mail?')
    await screen.findByText('Configurações')
    fireEvent.click(screen.getByRole('button', { name: 'Resposta útil' }))
    await waitFor(() =>
      expect(avaliarResposta).toHaveBeenCalledWith('log1', 'util'),
    )
    expect(screen.getByText('Obrigado pela avaliação.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resposta ruim' })).toBeNull()
  })

  it('HTML na resposta aparece como texto, nunca como elemento', async () => {
    perguntar.mockResolvedValue(
      resposta({ resposta: '<img src=x onerror=alert(1)> **ok**', fontes: [] }),
    )
    abrir()
    await perguntarComTexto('teste de segurança')
    const conversa = await screen.findByRole('list', { name: 'Conversa' })
    await within(conversa).findByText(/<img src=x/)
    expect(conversa.querySelector('img')).toBeNull()
  })

  it('Enter envia e Shift+Enter não', async () => {
    abrir()
    const caixa = screen.getByLabelText('Sua pergunta')
    fireEvent.change(caixa, { target: { value: 'pergunta por teclado' } })
    fireEvent.keyDown(caixa, { key: 'Enter', shiftKey: true })
    expect(perguntar).not.toHaveBeenCalled()
    fireEvent.keyDown(caixa, { key: 'Enter' })
    await waitFor(() => expect(perguntar).toHaveBeenCalledTimes(1))
  })

  it('não envia pergunta curta demais', () => {
    abrir()
    fireEvent.change(screen.getByLabelText('Sua pergunta'), {
      target: { value: 'oi' },
    })
    expect(screen.getByRole('button', { name: /perguntar/i })).toBeDisabled()
  })
})
