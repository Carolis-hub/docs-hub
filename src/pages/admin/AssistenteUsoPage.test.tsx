import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistenteUsoPage } from './AssistenteUsoPage'

const listarUso = vi.fn()
const listarRegistros = vi.fn()

vi.mock('../../services/assistenteAdmin', () => ({
  listarUso: (...a: unknown[]) => listarUso(...a),
  listarRegistros: (...a: unknown[]) => listarRegistros(...a),
}))
vi.mock('../../services/users', () => ({
  listUsers: async () => [{ uid: 'u1', nome: 'Ana' }],
}))

const log = (extra: Record<string, unknown>) => ({
  id: 'l',
  uid: 'u1',
  dia: '2026-11-01',
  criadoEm: 1,
  pergunta: 'Pergunta',
  encontrou: true,
  fontes: [],
  filtros: {},
  modelo: 'm',
  tokensEntrada: 0,
  tokensSaida: 0,
  custoUsd: 0.05,
  ms: 1,
  feedback: null,
  ...extra,
})

beforeEach(() => {
  listarUso.mockResolvedValue([
    {
      id: 'g_2026-11-01',
      tipo: 'global',
      dia: '2026-11-01',
      perguntas: 4,
      custoUsd: 0.2,
      tokensEntrada: 4000,
      tokensSaida: 800,
    },
    {
      id: 'u_u1_2026-11-01',
      tipo: 'usuario',
      uid: 'u1',
      dia: '2026-11-01',
      perguntas: 4,
      custoUsd: 0.2,
      tokensEntrada: 1,
      tokensSaida: 1,
    },
  ])
  listarRegistros.mockResolvedValue([
    log({ id: '1', pergunta: 'Como exportar PDF?', encontrou: false }),
    log({ id: '2', pergunta: 'como exportar pdf?', encontrou: false }),
    log({ id: '3', pergunta: 'Pergunta ruim', feedback: 'ruim' }),
    log({ id: '4', pergunta: 'Pergunta boa', feedback: 'util' }),
  ])
})

describe('AssistenteUsoPage', () => {
  it('mostra totais, gasto, lacunas da documentação, avaliações e uso por pessoa', async () => {
    render(
      <MemoryRouter>
        <AssistenteUsoPage />
      </MemoryRouter>,
    )
    const totais = await screen.findByRole('region', { name: 'Totais' })
    expect(within(totais).getByText('4')).toBeInTheDocument()
    expect(within(totais).getByText('US$ 0,20')).toBeInTheDocument()
    expect(within(totais).getByText('4.000 / 800')).toBeInTheDocument()
    expect(within(totais).getByText('50%')).toBeInTheDocument()

    const lacunas = screen.getByRole('region', {
      name: 'Perguntas sem resposta',
    })
    expect(within(lacunas).getByText('Como exportar PDF?')).toBeInTheDocument()
    expect(within(lacunas).getByText('2×')).toBeInTheDocument()

    const avaliacoes = screen.getByRole('region', { name: 'Avaliações' })
    expect(within(avaliacoes).getByText(/1 útil · 1 ruim/)).toBeInTheDocument()
    expect(within(avaliacoes).getByText(/Pergunta ruim/)).toBeInTheDocument()

    const porPessoa = screen.getByRole('region', { name: 'Uso por pessoa' })
    expect(within(porPessoa).getByText('Ana')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Uso por dia' }),
    ).toHaveTextContent('01/11/2026')
  })

  it('sem uso ainda, explica em vez de mostrar tabelas vazias', async () => {
    listarUso.mockResolvedValue([])
    listarRegistros.mockResolvedValue([])
    render(
      <MemoryRouter>
        <AssistenteUsoPage />
      </MemoryRouter>,
    )
    expect(
      await screen.findByText('Nenhum uso no período.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Ninguém usou ainda.')).toBeInTheDocument()
  })
})
