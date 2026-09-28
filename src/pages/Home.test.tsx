import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Home } from './Home'
import * as blocksService from '../services/blocks'
import * as userProfileHook from '../hooks/useUserProfile'
import type { Block } from '../types/block'
import type { AppUser } from '../types/user'

vi.mock('../services/blocks', () => ({
  listProducts: vi.fn(),
}))

vi.mock('../hooks/useUserProfile', () => ({
  useUserProfile: vi.fn(),
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

const adminExemplo: AppUser = {
  uid: 'admin-1',
  nome: 'Admin',
  email: 'admin@teste.com',
  role: 'admin',
  produtosPermitidos: [],
  verTecnico: true,
  ativo: true,
}

describe('Home', () => {
  it('lista os produtos cadastrados', async () => {
    vi.mocked(userProfileHook.useUserProfile).mockReturnValue({
      profile: adminExemplo,
      loading: false,
      reload: vi.fn(),
    })
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
    vi.mocked(userProfileHook.useUserProfile).mockReturnValue({
      profile: adminExemplo,
      loading: false,
      reload: vi.fn(),
    })
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

  it('não lista produtos quando o leitor não tem nenhum permitido', async () => {
    vi.mocked(userProfileHook.useUserProfile).mockReturnValue({
      profile: { ...adminExemplo, role: 'reader', produtosPermitidos: [] },
      loading: false,
      reload: vi.fn(),
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(
        screen.getByText('Nenhum produto cadastrado ainda.'),
      ).toBeInTheDocument(),
    )
    expect(blocksService.listProducts).not.toHaveBeenCalled()
  })
})
