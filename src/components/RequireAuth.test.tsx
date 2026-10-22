import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RequireAuth } from './RequireAuth'

const useAuth = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => useAuth() }))

const renderar = () =>
  render(
    <MemoryRouter>
      <RequireAuth>
        <p>conteúdo</p>
      </RequireAuth>
    </MemoryRouter>,
  )

describe('RequireAuth', () => {
  it('mostra o conteúdo para quem tem perfil ativo', () => {
    useAuth.mockReturnValue({ user: {}, profile: { uid: 'u' }, loading: false })
    renderar()
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  it('bloqueia conta sem perfil ou desativada', () => {
    useAuth.mockReturnValue({ user: {}, profile: null, loading: false })
    renderar()
    expect(screen.getByText(/sem acesso/i)).toBeInTheDocument()
    expect(screen.queryByText('conteúdo')).toBeNull()
  })
})
