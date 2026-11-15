import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ConfiguracoesPage } from './ConfiguracoesPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'a' },
    profile: { uid: 'a', role: 'admin' },
    isAdmin: true,
  }),
}))
vi.mock('../../services/users', () => ({
  listUsers: vi.fn(async () => [
    { uid: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'reader' },
  ]),
  deleteUsers: vi.fn(),
}))

describe('ConfiguracoesPage', () => {
  it('tem dois blocos: Configuração de usuário (com a lista) e Governança', async () => {
    render(
      <MemoryRouter>
        <ConfiguracoesPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Configuração de usuário' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Governança' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Minhas configurações' }),
    ).not.toBeInTheDocument()
  })

  it('traz o módulo Governança com Revisão, Sincronização e Auditoria', () => {
    render(
      <MemoryRouter>
        <ConfiguracoesPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /revisão/i })).toHaveAttribute(
      'href',
      '/admin/revisao',
    )
    expect(
      screen.getByRole('link', { name: /sincronização/i }),
    ).toHaveAttribute('href', '/admin/sincronizacao')
    expect(screen.getByRole('link', { name: /auditoria/i })).toHaveAttribute(
      'href',
      '/admin/auditoria',
    )
    expect(screen.getByRole('link', { name: /uso da ia/i })).toHaveAttribute(
      'href',
      '/admin/assistente',
    )
  })
})
