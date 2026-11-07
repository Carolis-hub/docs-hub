import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { IndexedItem } from '../types/search'
import { criarMotor } from '../utils/searchEngine'
import { CategoriasPage } from './CategoriasPage'

const useSearchEngine = vi.fn()
vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => useSearchEngine(),
}))

const item = (
  id: string,
  categoria?: IndexedItem['categoria'],
): IndexedItem => ({
  id,
  titulo: id,
  resumo: '',
  textoPlano: id,
  blockId: 'p',
  productId: 'p',
  publico: 'usuario',
  ...(categoria ? { categoria } : {}),
})

describe('CategoriasPage', () => {
  it('mostra as quatro categorias com a contagem e o link para navegar', () => {
    useSearchEngine.mockReturnValue({
      dados: {
        motor: criarMotor(
          [
            item('a', 'processos'),
            item('b', 'processos'),
            item('c', 'configuracoes'),
            item('d'),
          ],
          true,
        ),
      },
      erro: null,
      carregando: false,
    })
    render(
      <MemoryRouter>
        <CategoriasPage />
      </MemoryRouter>,
    )
    const processos = screen.getByRole('link', { name: /Processos/ })
    expect(processos).toHaveAttribute('href', '/busca?categoria=processos')
    expect(within(processos).getByText('2 artigos')).toBeInTheDocument()
    expect(
      within(screen.getByRole('link', { name: /Configurações/ })).getByText(
        '1 artigo',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('link', { name: /Funcionalidades/ })).getByText(
        '0 artigos',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/1 artigo ainda sem categoria \(de 4\)/),
    ).toBeInTheDocument()
  })
})
