import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Ficha } from '../types/content'
import { FichaDoProduto } from './FichaDoProduto'

const ficha: Ficha = {
  secoes: [
    {
      id: 't1',
      tipo: 'tabela',
      titulo: 'Compatibilidade DI',
      texto: 'Em **negrito** estão as versões homologadas.',
      colunas: ['SmartShare', 'DI Client'],
      linhas: [['3.85.23', '**3.85.19**']],
    },
    {
      id: 'l1',
      tipo: 'links',
      titulo: 'Instaladores',
      texto: 'Acesse https://portal.example.com para baixar.',
      itens: [
        { rotulo: 'Portal', url: 'https://portal.example.com' },
        { rotulo: 'Sem endereço', url: '' },
        { rotulo: 'Perigoso', url: 'javascript:alert(1)' },
      ],
    },
  ],
}

describe('FichaDoProduto', () => {
  it('mostra a tabela com as versões homologadas em negrito', () => {
    render(<FichaDoProduto ficha={ficha} />)
    const tabela = screen.getByRole('table')
    expect(
      within(tabela).getByRole('columnheader', { name: 'DI Client' }),
    ).toBeInTheDocument()
    const negrito = within(tabela).getByText('3.85.19')
    expect(negrito.tagName).toBe('STRONG')
    expect(within(tabela).getByText('3.85.23').tagName).toBe('SPAN')
  })

  it('cada seção é uma aba e só a escolhida aparece', () => {
    render(<FichaDoProduto ficha={ficha} />)
    const abas = screen.getAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual([
      'Compatibilidade DI',
      'Instaladores',
    ])
    expect(abas[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Portal/ })).toBeNull()
    fireEvent.click(abas[1] as HTMLElement)
    expect(abas[1]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('link', { name: /^Portal/ })).toBeInTheDocument()
  })

  it('as setas do teclado trocam de aba', () => {
    render(<FichaDoProduto ficha={ficha} />)
    const lista = screen.getByRole('tablist')
    fireEvent.keyDown(lista, { key: 'ArrowRight' })
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.keyDown(lista, { key: 'ArrowRight' })
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute(
      'aria-selected',
      'true',
    )
    fireEvent.keyDown(lista, { key: 'End' })
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('links: só endereços seguros viram link', () => {
    render(<FichaDoProduto ficha={ficha} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Instaladores' }))
    const portal = screen.getByRole('link', { name: /^Portal/ })
    expect(portal).toHaveAttribute('href', 'https://portal.example.com')
    expect(portal).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.queryByRole('link', { name: /Perigoso/ })).toBeNull()
    expect(screen.getByText('Perigoso')).toBeInTheDocument()
    expect(screen.getByText('Sem endereço')).toBeInTheDocument()
  })

  it('ficha vazia não mostra nada', () => {
    const { container } = render(<FichaDoProduto ficha={{ secoes: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
