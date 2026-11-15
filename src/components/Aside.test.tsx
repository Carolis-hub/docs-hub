import { fireEvent, render, screen } from '@testing-library/react'
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
      screen.getByRole('link', { name: 'Buscar Artigo' }),
    ).toBeInTheDocument()
  })

  it('esconde a entrada que o administrador bloqueou', () => {
    perfil = { role: 'reader', permissoes: { busca: false } }
    mostrar()
    expect(
      screen.getByRole('link', { name: 'Manual de produtos' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Buscar Artigo' })).toBeNull()
  })

  it('sem nenhuma entrada liberada, a aside não aparece', () => {
    perfil = { role: 'reader', permissoes: { manual: false, busca: false } }
    const { container } = mostrar()
    expect(container).toBeEmptyDOMElement()
  })

  it('pode ser recolhida e expandida; a escolha fica guardada no navegador', () => {
    perfil = { role: 'reader' }
    window.localStorage.clear()
    const { unmount } = mostrar()
    fireEvent.click(
      screen.getByRole('button', { name: 'Recolher menu lateral' }),
    )
    const expandir = screen.getByRole('button', {
      name: 'Expandir menu lateral',
    })
    expect(expandir).toHaveAttribute('aria-expanded', 'false')
    // Recolhida, os links continuam (só com o ícone na tela).
    expect(
      screen.getByRole('link', { name: 'Buscar Artigo' }),
    ).toBeInTheDocument()
    unmount()
    mostrar()
    expect(
      screen.getByRole('button', { name: 'Expandir menu lateral' }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Expandir menu lateral' }),
    )
    expect(
      screen.getByRole('button', { name: 'Recolher menu lateral' }),
    ).toHaveAttribute('aria-expanded', 'true')
    window.localStorage.clear()
  })

  it('fica fixa enquanto a tela rola', () => {
    perfil = { role: 'reader' }
    mostrar()
    expect(screen.getByRole('complementary').className).toContain('md:sticky')
  })
})
