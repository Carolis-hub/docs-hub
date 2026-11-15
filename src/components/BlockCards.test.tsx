import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Block } from '../types/content'
import { BlockCards } from './BlockCards'

const produto = (extra: Partial<Block> = {}): Block => ({
  id: 'p1',
  nome: 'SmartShare 4',
  slug: 'smartshare-4',
  descricao: '',
  icone: '',
  ordem: 0,
  parentId: null,
  productId: 'p1',
  ...extra,
})

function mostrar(blocos: Block[], editavel = false) {
  render(
    <MemoryRouter>
      <BlockCards blocos={blocos} variante="produto" editavel={editavel} />
    </MemoryRouter>,
  )
}

describe('BlockCards (produto)', () => {
  it('destaca o nome do produto e mostra a descrição', () => {
    mostrar([produto({ descricao: 'Gestão de documentos e fluxos.' })])
    expect(screen.getByText('Produto')).toBeInTheDocument()
    expect(screen.getByText('SmartShare 4')).toBeInTheDocument()
    expect(
      screen.getByText('Gestão de documentos e fluxos.'),
    ).toBeInTheDocument()
  })

  it('sem descrição, o leitor vê um aviso curto e o admin vê a dica de editar', () => {
    mostrar([produto()])
    expect(screen.getByText('Sem descrição.')).toBeInTheDocument()
  })

  it('o admin recebe a dica para escrever a descrição', () => {
    mostrar([produto()], true)
    expect(
      screen.getByText(/use editar para escrever uma breve descrição/i),
    ).toBeInTheDocument()
  })

  const filhos = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      produto({ id: `s${i + 1}`, nome: `Sub ${i + 1}`, parentId: 'p1' }),
    )
  const comSubprodutos = (n: number) =>
    render(
      <MemoryRouter>
        <BlockCards
          blocos={[produto()]}
          variante="produto"
          subprodutos={{ p1: filhos(n) }}
        />
      </MemoryRouter>,
    )

  it('até 5 subprodutos: lista todos, sem "Ver mais"', () => {
    comSubprodutos(5)
    const lista = within(
      screen.getByRole('list', { name: 'Subprodutos de SmartShare 4' }),
    )
    expect(lista.getAllByRole('link')).toHaveLength(5)
    expect(lista.queryByText('Ver mais')).toBeNull()
  })

  it('mais de 5: mostra 5 e o "Ver mais", que leva à tela do produto', () => {
    comSubprodutos(7)
    const lista = within(
      screen.getByRole('list', { name: 'Subprodutos de SmartShare 4' }),
    )
    expect(lista.getByRole('link', { name: 'Sub 5' })).toBeInTheDocument()
    expect(lista.queryByRole('link', { name: 'Sub 6' })).toBeNull()
    expect(
      lista.getByRole('link', {
        name: 'Ver mais subprodutos de SmartShare 4',
      }),
    ).toHaveAttribute('href', '/b/p1')
  })
})
