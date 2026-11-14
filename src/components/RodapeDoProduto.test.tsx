import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { Block } from '../types/content'

vi.mock('../services/blocks', () => ({ salvarRodape: vi.fn() }))

const { RodapeDoProduto } = await import('./RodapeDoProduto')

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

  const configurado = produto({
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
                'Veja **tudo** em [site](https://x.com) \\*sem formatar\\*\n\n| Sistema | Versão |\n| --- | --- |\n| Windows | 11 |',
            },
            { id: 'i2', titulo: 'Só link', url: '/b/x', conteudo: '' },
            { id: 'i3', titulo: 'Só título', url: '', conteudo: '' },
          ],
        },
        { id: 'c2', titulo: 'Contato', itens: [] },
      ],
    },
  })

  it('na tela ficam só o nome da coluna e os títulos das opções', () => {
    mostrar(configurado)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText('Compatibilidade')).toBeInTheDocument()
    expect(screen.getByText('Contato')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Compatibilidade DI' }),
    ).toBeInTheDocument()
    // Opção sem conteúdo: o título leva direto ao link (ou é só texto).
    expect(screen.getByRole('link', { name: 'Só link' })).toHaveAttribute(
      'href',
      '/b/x',
    )
    expect(screen.getByText('Só título')).toBeInTheDocument()
    // O conteúdo não aparece até abrir a opção.
    expect(screen.queryByText('tudo')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clicar no título abre a janela com o conteúdo, a tabela e o link', () => {
    mostrar(configurado)
    fireEvent.click(screen.getByRole('button', { name: 'Compatibilidade DI' }))
    const janela = within(
      screen.getByRole('dialog', { name: 'Compatibilidade DI' }),
    )
    expect(janela.getByText('tudo').closest('strong')).not.toBeNull()
    expect(janela.getByRole('link', { name: 'site' })).toHaveAttribute(
      'href',
      'https://x.com',
    )
    expect(janela.getByText(/\*sem formatar\*/)).toBeInTheDocument()
    expect(
      janela.getByRole('columnheader', { name: 'Sistema' }),
    ).toBeInTheDocument()
    expect(janela.getByRole('cell', { name: 'Windows' })).toBeInTheDocument()
    expect(
      janela.getByRole('link', { name: /abrir a página/i }),
    ).toHaveAttribute('href', '/b/di')
    fireEvent.click(janela.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Esc fecha a janela', () => {
    mostrar(configurado)
    fireEvent.click(screen.getByRole('button', { name: 'Compatibilidade DI' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a configuração abre no lugar do rodapé, só para quem pode configurar', () => {
    mostrar(configurado)
    expect(
      screen.queryByRole('button', { name: /configurar rodapé/i }),
    ).toBeNull()
    render(
      <MemoryRouter>
        <RodapeDoProduto
          produto={configurado}
          configuracao={{ uid: 'a', aoSalvar: vi.fn() }}
        />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /configurar rodapé/i }))
    expect(
      screen.getByRole('heading', { name: 'Rodapé do produto' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(
      screen.getByRole('button', { name: /configurar rodapé/i }),
    ).toBeInTheDocument()
  })

  it('sem rodapé, quem configura vê o convite no fim da página', () => {
    render(
      <MemoryRouter>
        <RodapeDoProduto
          produto={produto()}
          configuracao={{ uid: 'a', aoSalvar: vi.fn() }}
        />
      </MemoryRouter>,
    )
    fireEvent.click(
      screen.getByRole('button', { name: /ainda não tem rodapé/i }),
    )
    expect(
      screen.getByRole('heading', { name: 'Rodapé do produto' }),
    ).toBeInTheDocument()
  })
})
