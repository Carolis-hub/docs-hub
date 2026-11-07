import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sincronizacao } from '../../types/sincronizacao'
import { SincronizacaoPage } from './SincronizacaoPage'

const listarSincronizacoes = vi.fn()
vi.mock('../../services/sincronizacao', () => ({
  listarSincronizacoes: () => listarSincronizacoes(),
}))

const DIA = 24 * 3600 * 1000
const fonte = (extra: Partial<Sincronizacao> = {}): Sincronizacao => ({
  fonteId: 'di-docs',
  produtoId: 'p',
  produtoNome: 'SmartShare DI',
  ultimaExecucao: Date.now() - 5 * 60_000,
  ultimaMudanca: Date.now() - 2 * 3600_000,
  modo: 'observar',
  repo: null,
  commit: null,
  duracaoMs: 100,
  resumo: {
    novo: 2,
    alterado: 1,
    'sem-alteracao': 30,
    reapareceu: 0,
    duplicado: 1,
    removido: 0,
    erro: 0,
    ignorado: 3,
  },
  erros: [],
  removidos: [],
  ...extra,
})

function abrir() {
  render(
    <MemoryRouter>
      <SincronizacaoPage />
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('SincronizacaoPage', () => {
  it('mostra a fonte em dia com produto, modo, tempo e contagens da última rodada', async () => {
    listarSincronizacoes.mockResolvedValue([
      fonte({ commit: 'abcdef1234567', repo: 'org/docs' }),
    ])
    abrir()
    const card = await screen.findByRole('listitem', { name: 'di-docs' })
    expect(within(card).getByText('Em dia')).toBeInTheDocument()
    expect(within(card).getByText('Vigiando a pasta')).toBeInTheDocument()
    expect(card).toHaveTextContent('Produto: SmartShare DI')
    expect(card).toHaveTextContent('conferida há 5 min')
    expect(card).toHaveTextContent('última mudança há 2 h')
    expect(card).toHaveTextContent('commit abcdef1')
    expect(card).toHaveTextContent('org/docs')
    expect(card).toHaveTextContent('2 novos · 1 alterados · 30 sem alteração')
  })

  it('destaca os arquivos que deram erro e explica como resolver', async () => {
    listarSincronizacoes.mockResolvedValue([
      fonte({
        erros: [
          { caminho: 'guias/quebrado.md', detalhe: 'imagem não encontrada' },
        ],
        resumo: { ...fonte().resumo, erro: 3 },
      }),
    ])
    abrir()
    const card = await screen.findByRole('listitem', { name: 'di-docs' })
    expect(within(card).getByText('Com erros')).toBeInTheDocument()
    expect(card).toHaveTextContent('Arquivos que não entraram (1 de 3)')
    expect(card).toHaveTextContent('guias/quebrado.md')
    expect(card).toHaveTextContent('imagem não encontrada')
    expect(card).toHaveTextContent('rode a ingestão de novo')
  })

  it('avisa quando a fonte está parada há mais de 7 dias', async () => {
    listarSincronizacoes.mockResolvedValue([
      fonte({ ultimaExecucao: Date.now() - 9 * DIA, modo: 'manual' }),
    ])
    abrir()
    const card = await screen.findByRole('listitem', { name: 'di-docs' })
    expect(within(card).getByText('Desatualizada')).toBeInTheDocument()
    expect(card).toHaveTextContent('mais de 7 dias')
    expect(card).toHaveTextContent('há 9 dias')
  })

  it('lista os arquivos removidos com o caminho para a tela Revisão', async () => {
    listarSincronizacoes.mockResolvedValue([fonte({ removidos: ['velho.md'] })])
    abrir()
    expect(await screen.findByText('velho.md')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revisão' })).toHaveAttribute(
      'href',
      '/admin/revisao',
    )
  })

  it('põe primeiro a fonte com erro, e explica quando ainda não há nenhuma', async () => {
    listarSincronizacoes.mockResolvedValue([
      fonte({ fonteId: 'tranquila' }),
      fonte({
        fonteId: 'problema',
        erros: [{ caminho: 'a.md', detalhe: 'x' }],
      }),
    ])
    abrir()
    await screen.findByRole('listitem', { name: 'problema' })
    const titulos = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(titulos).toEqual(['problema', 'tranquila'])
  })

  it('sem fontes, ensina a primeira rodada', async () => {
    listarSincronizacoes.mockResolvedValue([])
    abrir()
    expect(
      await screen.findByText(/Nenhuma fonte sincronizada ainda/),
    ).toBeInTheDocument()
  })
})
