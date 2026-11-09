import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ConfiguracoesPage } from './ConfiguracoesPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'a' }, isAdmin: true }),
}))
vi.mock('../../services/preferencias', () => ({
  lerPreferencias: vi.fn(async () => null),
  salvarPreferencias: vi.fn(async () => undefined),
}))

describe('ConfiguracoesPage', () => {
  it('traz as configurações do usuário (aside) junto com os módulos de administração', () => {
    render(
      <MemoryRouter>
        <ConfiguracoesPage />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Minhas configurações' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Mostrar a aside')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Administração' }),
    ).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: /usuários/i })).toHaveAttribute(
      'href',
      '/admin/usuarios',
    )
    expect(screen.getByRole('link', { name: /uso da ia/i })).toHaveAttribute(
      'href',
      '/admin/assistente',
    )
  })
})
