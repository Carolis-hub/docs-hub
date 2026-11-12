import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

let perfil: unknown = { role: 'reader' }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u' }, profile: perfil }),
}))
vi.mock('../services/preferencias', () => ({
  lerPreferencias: vi.fn(async () => null),
  salvarPreferencias: vi.fn(async () => undefined),
}))

const { Aside } = await import('./Aside')

const mostrar = () =>
  render(
    <MemoryRouter>
      <Aside />
    </MemoryRouter>,
  )

describe('Aside e permissões', () => {
  it('mostra as duas entradas por padrão', () => {
    perfil = { role: 'reader' }
    mostrar()
    expect(
      screen.getByRole('link', { name: 'Manual de produtos' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Busca/consulta com IA' }),
    ).toBeInTheDocument()
  })

  it('esconde a entrada que o administrador bloqueou', () => {
    perfil = { role: 'reader', permissoes: { busca: false } }
    mostrar()
    expect(
      screen.getByRole('link', { name: 'Manual de produtos' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Busca/consulta com IA' }),
    ).toBeNull()
  })

  it('sem nenhuma entrada liberada, a aside não aparece', () => {
    perfil = { role: 'reader', permissoes: { manual: false, busca: false } }
    const { container } = mostrar()
    expect(container).toBeEmptyDOMElement()
  })
})
