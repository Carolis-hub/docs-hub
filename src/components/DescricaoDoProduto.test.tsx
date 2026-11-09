import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DescricaoDoProduto } from './DescricaoDoProduto'

describe('DescricaoDoProduto', () => {
  it('leitor vê a descrição e não vê o botão de editar', () => {
    render(
      <DescricaoDoProduto
        descricao="Gestão de documentos."
        editavel={false}
        aoSalvar={vi.fn()}
      />,
    )
    expect(screen.getByText('Gestão de documentos.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('leitor não vê nada quando não há descrição', () => {
    const { container } = render(
      <DescricaoDoProduto descricao="" editavel={false} aoSalvar={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('admin escreve a descrição e salva', async () => {
    const aoSalvar = vi.fn(async () => undefined)
    render(<DescricaoDoProduto descricao="" editavel aoSalvar={aoSalvar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Escrever descrição' }))
    fireEvent.change(screen.getByLabelText('Breve descrição do produto'), {
      target: { value: 'ECM e BPM.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar descrição' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledWith('ECM e BPM.'))
  })
})
