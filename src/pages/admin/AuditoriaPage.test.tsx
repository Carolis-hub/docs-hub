import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditoriaPage } from './AuditoriaPage'

const listarAuditoria = vi.fn()
const listUsers = vi.fn()

vi.mock('../../services/audit', () => ({
  listarAuditoria: (...a: unknown[]) => listarAuditoria(...a),
}))
vi.mock('../../services/users', () => ({
  listUsers: (...a: unknown[]) => listUsers(...a),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listUsers.mockResolvedValue([
    { uid: 'u1', nome: 'Ana' },
    { uid: 'u2', nome: 'Bruno' },
  ])
  listarAuditoria.mockResolvedValue([
    {
      id: '1',
      usuarioId: 'u1',
      acao: 'artigo.publicar',
      alvo: 'articles/a1',
      data: 3,
    },
    {
      id: '2',
      usuarioId: 'u2',
      acao: 'artigo.aprovar',
      alvo: 'articles/a1',
      data: 2,
      detalhe: 'alteração pendente',
    },
    {
      id: '3',
      usuarioId: 'u1',
      acao: 'usuario.criar',
      alvo: 'users/x',
      data: 1,
    },
  ])
})

function abrir() {
  render(
    <MemoryRouter>
      <AuditoriaPage />
    </MemoryRouter>,
  )
}

describe('AuditoriaPage', () => {
  it('mostra quem fez o quê, com nomes, ações em português e link para o artigo', async () => {
    abrir()
    expect(await screen.findByText('Publicou')).toBeInTheDocument()
    expect(screen.getByText('Aprovou')).toBeInTheDocument()
    expect(screen.getByText('(alteração pendente)')).toBeInTheDocument()
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0)
    const links = screen.getAllByRole('link', { name: 'articles/a1' })
    expect(links[0]).toHaveAttribute('href', '/admin/artigos/a1/editar')
    expect(screen.getByText('3 registros')).toBeInTheDocument()
  })

  it('filtra por tipo de ação e por usuário', async () => {
    abrir()
    await screen.findByText('Publicou')
    fireEvent.change(screen.getByLabelText('Filtrar por tipo de ação'), {
      target: { value: 'usuario' },
    })
    expect(screen.getByText('Criou um usuário')).toBeInTheDocument()
    expect(screen.queryByText('Publicou')).toBeNull()
    expect(screen.getByText('1 registro')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filtrar por tipo de ação'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('Filtrar por usuário'), {
      target: { value: 'u2' },
    })
    const lista = screen.getByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Aprovou')).toBeInTheDocument()
  })

  it('avisa quando os filtros não encontram nada', async () => {
    abrir()
    await screen.findByText('Publicou')
    fireEvent.change(screen.getByLabelText('Filtrar por tipo de ação'), {
      target: { value: 'bloco' },
    })
    expect(
      screen.getByText('Nenhum registro com esses filtros.'),
    ).toBeInTheDocument()
  })
})
