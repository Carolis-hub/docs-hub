import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { limparPreferenciasEmMemoria } from '../hooks/usePreferencias'
import { ConfiguracoesDoUsuario } from './ConfiguracoesDoUsuario'

const salvarPreferencias = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}))
vi.mock('../services/preferencias', () => ({
  lerPreferencias: vi.fn(async () => null),
  salvarPreferencias: (...a: unknown[]) => salvarPreferencias(...a),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  limparPreferenciasEmMemoria()
  salvarPreferencias.mockResolvedValue(undefined)
})

const prévia = () => screen.getByLabelText('Prévia da aside')

describe('ConfiguracoesDoUsuario', () => {
  it('começa com a aside completa e a prévia mostra as duas entradas', () => {
    render(<ConfiguracoesDoUsuario />)
    expect(screen.getByLabelText('Mostrar a aside')).toBeChecked()
    expect(prévia()).toHaveTextContent('Manual de produtos')
    expect(prévia()).toHaveTextContent('Busca/consulta com IA')
    expect(
      screen.getByRole('button', { name: 'Restaurar o padrão' }),
    ).toBeDisabled()
  })

  it('desmarcar uma entrada tira da prévia e grava na conta', async () => {
    render(<ConfiguracoesDoUsuario />)
    fireEvent.click(screen.getByLabelText('Busca/consulta com IA'))
    expect(prévia()).not.toHaveTextContent('Busca/consulta com IA')
    expect(prévia()).toHaveTextContent('Manual de produtos')
    await waitFor(() =>
      expect(salvarPreferencias).toHaveBeenCalledWith('u1', {
        aside: { visivel: true, manual: true, busca: false },
      }),
    )
  })

  it('ocultar a aside desliga as entradas e explica como reabrir', () => {
    render(<ConfiguracoesDoUsuario />)
    fireEvent.click(screen.getByLabelText('Mostrar a aside'))
    expect(screen.getByLabelText('Manual de produtos')).toBeDisabled()
    expect(prévia()).toHaveTextContent(/aside está oculta/)
  })

  it('sem nenhuma entrada marcada avisa que a aside não aparece', () => {
    render(<ConfiguracoesDoUsuario />)
    fireEvent.click(screen.getByLabelText('Manual de produtos'))
    fireEvent.click(screen.getByLabelText('Busca/consulta com IA'))
    expect(prévia()).toHaveTextContent(/Nenhuma entrada marcada/)
  })

  it('restaurar o padrão volta tudo', () => {
    render(<ConfiguracoesDoUsuario />)
    fireEvent.click(screen.getByLabelText('Manual de produtos'))
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar o padrão' }))
    expect(screen.getByLabelText('Manual de produtos')).toBeChecked()
  })
})
