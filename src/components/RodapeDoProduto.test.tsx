import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Block } from '../types/content'
import { RodapeDoProduto } from './RodapeDoProduto'

const produto = (extra: Partial<Block> = {}): Block => ({
  id: 'p',
  nome: 'SmartShare 4',
  slug: 's',
  descricao: '',
  icone: '',
  ordem: 0,
  parentId: null,
  productId: 'p',
  ...extra,
})

const mostrar = (p?: Block | null) =>
  render(
    <MemoryRouter>
      <RodapeDoProduto produto={p} />
    </MemoryRouter>,
  )

describe('RodapeDoProduto', () => {
  it('sem configuração não desenha nada, nem espaço vazio', () => {
    const { container } = render(
      <MemoryRouter>
        <RodapeDoProduto produto={produto()} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(mostrar(null).container.querySelector('footer')).toBeNull()
  })

  it('mostra as colunas, os itens com link e o Markdown com escapes', () => {
    mostrar(
      produto({
        rodape: {
          colunas: [
            {
              id: 'c1',
              titulo: 'Compatibilidade',
              itens: [
                {
                  id: 'i1',
                  titulo: 'Compatibilidade DI',
                  url: '/b/di',
                  conteudo:
                    'Veja **tudo** em [site](https://x.com) \\*sem formatar\\*',
                },
                {
                  id: 'i2',
                  titulo: 'Compatibilidade SmartShare',
                  url: '',
                  conteudo: '',
                },
              ],
            },
            { id: 'c2', titulo: 'Contato', itens: [] },
          ],
        },
      }),
    )
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText('Compatibilidade')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Compatibilidade DI' }),
    ).toHaveAttribute('href', '/b/di')
    expect(screen.getByText('Compatibilidade SmartShare')).toBeInTheDocument()
    expect(screen.getByText('tudo').closest('strong')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'site' })).toHaveAttribute(
      'href',
      'https://x.com',
    )
    expect(screen.getByText(/\*sem formatar\*/)).toBeInTheDocument()
  })
})
