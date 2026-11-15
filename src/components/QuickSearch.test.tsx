import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProdutoAtualContext } from '../contexts/produtoAtual'
import { criarMotor } from '../utils/searchEngine'

const item = (id: string, titulo: string, productId: string) => ({
  id,
  titulo,
  resumo: '',
  textoPlano: titulo,
  blockId: 'b',
  publico: 'usuario' as const,
  productId,
})
vi.mock('../hooks/useSearchEngine', () => ({
  useSearchEngine: () => ({
    dados: {
      produtos: [
        { id: 'p1', nome: 'SmartShare 4' },
        { id: 'p2', nome: 'Outro' },
      ],
      unidades: [],
      motor: criarMotor(
        [
          item('a1', 'Digitalizar documentos', 'p1'),
          item('a2', 'Digitalizar em lote', 'p2'),
        ],
        true,
      ),
    },
  }),
}))

const { QuickSearch } = await import('./QuickSearch')

function Onde() {
  const { pathname, search } = useLocation()
  return <p data-testid="onde">{pathname + search}</p>
}

function abrir(
  rota: string,
  produto: { id: string; nome: string } | null = null,
) {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <ProdutoAtualContext.Provider
        value={{ produto, definir: () => undefined }}
      >
        <QuickSearch />
        <Routes>
          <Route path="*" element={<Onde />} />
        </Routes>
      </ProdutoAtualContext.Provider>
    </MemoryRouter>,
  )
}

describe('QuickSearch', () => {
  it('fora de um produto, a busca não aparece', () => {
    abrir('/')
    expect(screen.queryByRole('search')).toBeNull()
  })

  it('dentro do produto, sugere e busca só os artigos dele', () => {
    abrir('/b/p1', { id: 'p1', nome: 'SmartShare 4' })
    const campo = screen.getByLabelText('Busca rápida em SmartShare 4')
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: 'digitalizar' } })
    expect(
      screen.getByRole('button', { name: 'Digitalizar documentos' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Digitalizar em lote' }),
    ).toBeNull()
    fireEvent.submit(screen.getByRole('search'))
    expect(screen.getByTestId('onde')).toHaveTextContent(
      '/busca?q=digitalizar&produto=p1',
    )
  })

  it('nos resultados da busca de um produto, continua limitada a ele', () => {
    abrir('/busca?q=x&produto=p2')
    expect(screen.getByLabelText('Busca rápida em Outro')).toBeInTheDocument()
  })
})
