import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Block } from '../types/content'
import { SeletorDeLocal } from './SeletorDeLocal'

const b = (id: string, nome: string, parentId: string | null, extra = {}) =>
  ({ id, nome, parentId, productId: 'p1', ...extra }) as Block

vi.mock('../services/unidades', () => ({
  listUnidades: async () => [{ id: 'u1', nome: 'Gestão Documental' }],
}))
vi.mock('../services/blocks', () => ({
  listProducts: async () => [b('p1', 'DocFlow ECM', null, { unidadeId: 'u1' })],
  listProductTree: async () => [
    b('p1', 'DocFlow ECM', null),
    b('s1', 'DocFlow Web', 'p1'),
    b('m1', 'Fluxos de aprovação', 's1'),
  ],
}))

describe('SeletorDeLocal', () => {
  it('escolhe em cascata e devolve o bloco mais fundo', async () => {
    const onChange = vi.fn()
    render(<SeletorDeLocal onChange={onChange} />)
    const produto = await screen.findByLabelText('Produto')
    expect(onChange).toHaveBeenLastCalledWith(null)
    fireEvent.change(produto, { target: { value: 'p1' } })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('p1'))
    fireEvent.change(await screen.findByLabelText('Subproduto'), {
      target: { value: 's1' },
    })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('s1'))
    fireEvent.change(await screen.findByLabelText('Módulo'), {
      target: { value: 'm1' },
    })
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('m1'))
  })
})
