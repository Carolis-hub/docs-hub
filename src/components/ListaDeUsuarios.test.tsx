import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usuarios = [
  { uid: 'a', nome: 'Admin', email: 'admin@x.com', role: 'admin' },
  { uid: 'u1', nome: 'Ana', email: 'ana@x.com', role: 'reader' },
  { uid: 'u2', nome: 'Bruno', email: 'bruno@x.com', role: 'reader' },
]
const deleteUsers = vi.fn(async (..._a: unknown[]) => undefined)
vi.mock('../services/users', () => ({
  listUsers: vi.fn(async () => usuarios),
  deleteUsers: (...a: unknown[]) => deleteUsers(...a),
}))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'a' } }),
}))

const { ListaDeUsuarios } = await import('./ListaDeUsuarios')

const abrir = async () => {
  render(
    <MemoryRouter>
      <ListaDeUsuarios />
    </MemoryRouter>,
  )
  await screen.findByText('Ana')
}

beforeEach(() => {
  deleteUsers.mockClear()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ListaDeUsuarios', () => {
  it('lista todos os usuários, com lápis e lixeira em cada um', async () => {
    await abrir()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Editar Ana' })).toHaveAttribute(
      'href',
      '/admin/usuarios/u1/editar',
    )
    expect(screen.getByRole('button', { name: 'Excluir Ana' })).toBeEnabled()
    expect(screen.getByRole('link', { name: /novo usuário/i })).toHaveAttribute(
      'href',
      '/admin/usuarios/novo',
    )
  })

  it('ninguém exclui a própria conta', async () => {
    await abrir()
    expect(screen.getByRole('button', { name: 'Excluir Admin' })).toBeDisabled()
    expect(screen.getByLabelText('Selecionar Admin')).toBeDisabled()
  })

  it('a lixeira da linha exclui só aquele usuário, depois de confirmar', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Ana' }))
    await waitFor(() => expect(deleteUsers).toHaveBeenCalledWith(['u1'], 'a'))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Usuário excluído.',
    )
  })

  it('sem confirmar, nada é excluído', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Ana' }))
    expect(deleteUsers).not.toHaveBeenCalled()
  })

  it('excluir em lote: só habilita com seleção e leva os marcados', async () => {
    await abrir()
    const lote = screen.getByRole('button', { name: /excluir selecionados/i })
    expect(lote).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Selecionar todos/))
    expect(lote).toHaveTextContent('(2)')
    fireEvent.click(lote)
    await waitFor(() =>
      expect(deleteUsers).toHaveBeenCalledWith(['u1', 'u2'], 'a'),
    )
  })
})
