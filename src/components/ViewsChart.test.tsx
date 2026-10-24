import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ViewsChart } from './ViewsChart'

const pontos = [
  { dia: '2026-05-01', count: 2 },
  { dia: '2026-05-02', count: 0 },
  { dia: '2026-05-03', count: 5 },
]

describe('ViewsChart', () => {
  it('resume o total e alterna para a tabela', () => {
    render(<ViewsChart pontos={pontos} />)
    expect(screen.getByText(/7 no período/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver tabela/i }))
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('03/05')).toBeInTheDocument()
  })
})
