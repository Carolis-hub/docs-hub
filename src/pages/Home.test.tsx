import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Home } from './Home'

describe('Home', () => {
  it('exibe a mensagem de boas-vindas', () => {
    render(<Home />)
    expect(
      screen.getByRole('heading', { name: /bem-vindo ao docs-hub/i }),
    ).toBeInTheDocument()
  })
})
