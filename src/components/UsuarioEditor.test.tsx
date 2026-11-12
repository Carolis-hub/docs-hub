import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUser } from '../types/user'

const updateUser = vi.fn(async () => undefined)
vi.mock('../services/users', () => ({
  updateUser: (...a: unknown[]) => updateUser(...(a as [])),
  createUser: vi.fn(),
}))

const { UsuarioEditor } = await import('./UsuarioEditor')

const leitor: AppUser = {
  uid: 'u1',
  nome: 'Ana',
  email: 'ana@x.com',
  role: 'reader',
  produtosPermitidos: [],
  verTecnico: false,
}

beforeEach(() => updateUser.mockClear())

describe('UsuarioEditor', () => {
  it('tem as abas Geral e Permissões, com os dados na primeira', () => {
    render(
      <UsuarioEditor
        produtos={[]}
        usuario={leitor}
        adminUid="a"
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Geral' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana')
    fireEvent.click(screen.getByRole('tab', { name: 'Permissões' }))
    expect(screen.getByRole('tab', { name: 'Permissões' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByLabelText(/Manual de produtos/)).toBeChecked()
    expect(screen.getByLabelText(/Busca\/consulta com IA/)).toBeChecked()
  })

  it('leitor não recebe telas de administração (exigem papel Admin)', () => {
    render(
      <UsuarioEditor
        produtos={[]}
        usuario={leitor}
        adminUid="a"
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Permissões' }))
    expect(screen.getByLabelText(/Auditoria/)).toBeDisabled()
    expect(screen.getByLabelText(/Auditoria/)).not.toBeChecked()
  })

  it('salva dados e permissões de uma vez', async () => {
    const onDone = vi.fn()
    render(
      <UsuarioEditor
        produtos={[]}
        usuario={leitor}
        adminUid="a"
        onDone={onDone}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Ana Maria' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Permissões' }))
    fireEvent.click(screen.getByLabelText(/Busca\/consulta com IA/))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('u1'))
    const [uid, patch] = updateUser.mock.calls[0] as unknown as [
      string,
      { nome: string; permissoes: Record<string, boolean> },
    ]
    expect(uid).toBe('u1')
    expect(patch.nome).toBe('Ana Maria')
    expect(patch.permissoes.busca).toBe(false)
    expect(patch.permissoes.manual).toBe(true)
  })

  it('o admin não consegue tirar o próprio acesso a esta tela', () => {
    render(
      <UsuarioEditor
        produtos={[]}
        usuario={{ ...leitor, uid: 'a', role: 'admin' }}
        adminUid="a"
        onDone={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Permissões' }))
    expect(screen.getByLabelText(/Configuração de usuários/)).toBeDisabled()
  })
})
