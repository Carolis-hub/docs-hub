import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PainelAssistente } from './PainelAssistente'

vi.mock('./AssistenteChat', () => ({
  AssistenteChat: () => <div>conversa do assistente</div>,
}))
vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => ({ dados: { motor: { total: 25 } } }),
}))

const painel = (aberto: boolean, aoFechar = vi.fn()) => (
  <MemoryRouter>
    <PainelAssistente aberto={aberto} aoFechar={aoFechar} />
  </MemoryRouter>
)

describe('PainelAssistente', () => {
  it('não monta nada antes da primeira abertura', () => {
    render(painel(false))
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('abre com o total de artigos e fecha por botão e por Escape', () => {
    const fechar = vi.fn()
    render(painel(true, fechar))
    expect(
      screen.getByRole('dialog', { name: 'Assistente de documentação' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Produto atual: 25 artigos')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: /fechar o assistente/i }),
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(fechar).toHaveBeenCalledTimes(2)
  })

  it('continua montado, só escondido, depois de fechar', () => {
    const { rerender } = render(painel(true))
    rerender(painel(false))
    expect(screen.getByText('conversa do assistente')).toBeInTheDocument()
    expect(
      screen.queryByRole('dialog', { name: 'Assistente de documentação' }),
    ).toBeNull()
  })
})
