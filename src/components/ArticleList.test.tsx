import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Article } from '../types/content'
import { ArticleList } from './ArticleList'

const artigo = (id: string, extra: Partial<Article> = {}): Article =>
  ({
    id,
    titulo: `Artigo ${id}`,
    resumo: 'Um resumo.',
    textoPlano: 'Um resumo.',
    status: 'published',
    publico: 'usuario',
    ...extra,
  }) as Article

const renderizar = (
  artigos: Article[],
  admin: boolean,
  visao: 'lista' | 'grade' = 'lista',
) =>
  render(
    <MemoryRouter>
      <ArticleList artigos={artigos} admin={admin} visao={visao} />
    </MemoryRouter>,
  )

describe('ArticleList', () => {
  it('mostra título, resumo e link para o artigo', () => {
    renderizar(
      [
        artigo('a1', {
          titulo: 'Como adicionar anexos',
          resumo: 'Passo a passo.',
        }),
      ],
      false,
    )
    const link = screen.getByRole('link', { name: /como adicionar anexos/i })
    expect(link).toHaveAttribute('href', '/a/a1')
    expect(screen.getByText('Passo a passo.')).toBeInTheDocument()
  })

  it('só o admin vê o aviso de imagem não migrada e o rascunho', () => {
    const lista = [
      artigo('a1', {
        textoPlano: 'Texto [Imagem não migrada: http://x/y.gif] fim',
        status: 'draft',
      }),
    ]
    const { unmount } = renderizar(lista, true)
    expect(screen.getByText('Imagem não migrada')).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()
    unmount()
    renderizar(lista, false)
    expect(screen.queryByText('Imagem não migrada')).toBeNull()
    expect(screen.queryByText('Rascunho')).toBeNull()
  })

  it('tira o marcador de imagem do resumo mostrado', () => {
    renderizar(
      [
        artigo('a1', {
          resumo: 'Antes [Imagem não migrada: http://x/y.gif] depois',
        }),
      ],
      false,
    )
    expect(screen.getByText('Antes depois')).toBeInTheDocument()
  })

  it('marca artigos técnicos', () => {
    renderizar([artigo('a1', { publico: 'tecnico' })], false)
    expect(screen.getByText('Técnico')).toBeInTheDocument()
  })

  it('a grade usa duas colunas', () => {
    const { container } = renderizar(
      [artigo('a1'), artigo('a2')],
      false,
      'grade',
    )
    expect(container.querySelector('ul')?.className).toContain('sm:grid-cols-2')
  })
})
