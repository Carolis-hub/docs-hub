import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ConfiguracoesPage } from './ConfiguracoesPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'a' }, isAdmin: true }),
}))

describe('ConfiguracoesPage', () => {
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
  })
})
