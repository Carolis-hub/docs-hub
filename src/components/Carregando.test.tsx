import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Carregando } from './Carregando'

describe('Carregando', () => {
  it('avisa o carregamento com o fundo desfocado por cima da tela', () => {
    render(<Carregando />)
    const aviso = screen.getByRole('status')
    expect(aviso).toHaveTextContent('Carregando…')
    expect(aviso.className).toContain('backdrop-blur')
    expect(aviso.className).toContain('fixed')
  })
  it('aceita outro texto', () => {
    render(<Carregando texto="Carregando índice…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando índice…')
  })
})
