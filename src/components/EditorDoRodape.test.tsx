import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block } from '../types/content'

const salvarRodape = vi.fn(async (_id: string, r: unknown, _uid: string) => r)
vi.mock('../services/blocks', () => ({
  salvarRodape: (id: string, r: unknown, uid: string) =>
    salvarRodape(id, r, uid),
}))

const { EditorDoRodape } = await import('./EditorDoRodape')

const produto: Block = {
  id: 'p',
  nome: 'SmartShare 4',
  slug: 's',
  descricao: '',
  icone: '',
  ordem: 0,
  parentId: null,
  productId: 'p',
}

beforeEach(() => salvarRodape.mockClear())

describe('EditorDoRodape', () => {
  it('cria coluna e item pelo modal e grava o rodapé', async () => {
    const aoSalvar = vi.fn()
    render(
      <MemoryRouter>
        <EditorDoRodape produto={produto} uid="a" aoSalvar={aoSalvar} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /adicionar coluna/i }))
    fireEvent.change(screen.getByLabelText('Título da coluna 1'), {
      target: { value: 'Compatibilidade' },
    })
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }))
    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome do item'), {
      target: { value: 'Compatibilidade DI' },
    })
    fireEvent.change(screen.getByLabelText(/conteúdo \(markdown\)/i), {
      target: { value: 'texto' },
    })
    fireEvent.click(screen.getByRole('button', { name: /inserir link/i }))
    fireEvent.change(screen.getByLabelText('Texto do link'), {
      target: { value: 'site' },
    })
    fireEvent.change(screen.getByLabelText('Endereço'), {
      target: { value: 'https://x.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Inserir' }))
    expect(
      (screen.getByLabelText(/conteúdo \(markdown\)/i) as HTMLTextAreaElement)
        .value,
    ).toBe('texto[site](https://x.com)')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Compatibilidade DI')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar rodapé' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    const gravado = salvarRodape.mock.calls[0]?.[1] as {
      colunas: {
        titulo: string
        itens: { titulo: string; conteudo: string }[]
      }[]
    }
    expect(gravado.colunas[0]?.titulo).toBe('Compatibilidade')
    expect(gravado.colunas[0]?.itens[0]).toMatchObject({
      titulo: 'Compatibilidade DI',
      conteudo: 'texto[site](https://x.com)',
    })
  })

  it('cancelar o modal não cria o item; link inválido é recusado', () => {
    render(
      <MemoryRouter>
        <EditorDoRodape produto={produto} uid="a" aoSalvar={vi.fn()} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /adicionar coluna/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar item/i }))
    fireEvent.change(screen.getByLabelText('Nome do item'), {
      target: { value: 'X' },
    })
    fireEvent.change(screen.getByLabelText(/link do título/i), {
      target: { value: 'javascript:alert(1)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar item' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      /link do título inválido/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('X')).toBeNull()
  })

  it('reordena e remove colunas', () => {
    render(
      <MemoryRouter>
        <EditorDoRodape
          produto={{
            ...produto,
            rodape: {
              colunas: [
                { id: 'a', titulo: 'A', itens: [] },
                { id: 'b', titulo: 'B', itens: [] },
              ],
            },
          }}
          uid="a"
          aoSalvar={vi.fn()}
        />
      </MemoryRouter>,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Mover coluna 1 para a direita' }),
    )
    expect(
      (screen.getByLabelText('Título da coluna 1') as HTMLInputElement).value,
    ).toBe('B')
    fireEvent.click(screen.getByRole('button', { name: 'Remover coluna 1' }))
    expect(screen.queryByDisplayValue('B')).toBeNull()
  })
})
