import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Home } from './Home'
import * as blocksService from '../services/blocks'
import type { Block } from '../types/block'

vi.mock('../services/blocks', () => ({
  listProducts: vi.fn(),
}))

const produtoExemplo: Block = {
  id: 'smartshare',
  nome: 'Smartshare',
  slug: 'smartshare',
  descricao: 'Plataforma de BPM e ECM',
  icone: '',
  ordem: 0,
  parentId: null,
  productId: 'smartshare',
}

describe('Home', () => {
  it('lista os produtos cadastrados', async () => {
    vi.mocked(blocksService.listProducts).mockResolvedValue([produtoExemplo])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByText('Smartshare')).toBeInTheDocument(),
    )
  })

  it('exibe mensagem de erro quando a busca falha', async () => {
    vi.mocked(blocksService.listProducts).mockRejectedValue(new Error('falhou'))

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível carregar os produtos.',
      ),
    )
  })
})
