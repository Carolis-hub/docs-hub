import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Ficha } from '../types/content'
import { EditorDaFicha } from './EditorDaFicha'

const inicial: Ficha = {
  secoes: [
    {
      id: 't1',
      tipo: 'tabela',
      titulo: 'Compatibilidade',
      texto: '',
      colunas: ['SmartShare', 'DI'],
      linhas: [['3.85.23', '3.85.19']],
    },
  ],
}

describe('EditorDaFicha', () => {
  it('edita a tabela em texto e salva com as linhas novas', async () => {
    const aoSalvar = vi.fn(async () => undefined)
    render(
      <EditorDaFicha
        inicial={inicial}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Tabela/), {
      target: {
        value: 'SmartShare | DI\n3.86.7 | **3.86.7**\n3.85.23 | 3.85.19',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    const salva = (aoSalvar.mock.calls[0] as unknown as [Ficha])[0]
    expect(salva.secoes[0]).toMatchObject({
      tipo: 'tabela',
      colunas: ['SmartShare', 'DI'],
      linhas: [
        ['3.86.7', '**3.86.7**'],
        ['3.85.23', '3.85.19'],
      ],
    })
  })

  it('adiciona uma seção de links e a remove', () => {
    render(
      <EditorDaFicha
        inicial={inicial}
        aoSalvar={vi.fn()}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    expect(screen.getByLabelText(/Links \(um por linha/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Remover a seção 2/ }))
    expect(screen.queryByLabelText(/Links \(um por linha/)).toBeNull()
  })

  it('sem seções oferece começar pelo modelo', () => {
    render(
      <EditorDaFicha
        inicial={{ secoes: [] }}
        aoSalvar={vi.fn()}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Começar pelo modelo/ }))
    expect(screen.getAllByLabelText('Título')).toHaveLength(5)
  })

  it('mostra o erro de gravação', async () => {
    const aoSalvar = vi.fn(async () => {
      throw new Error('Sem permissão')
    })
    render(
      <EditorDaFicha
        inicial={inicial}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão')
  })
})
