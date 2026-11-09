import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Ficha } from '../types/content'
import { completarFicha } from '../utils/ficha'
import { EditorDaFicha } from './EditorDaFicha'

const salva: Ficha = {
  secoes: [
    {
      id: 'compatibilidade-di',
      tipo: 'tabela',
      titulo: 'Compatibilidade DI',
      texto: '',
      colunas: ['SmartShare', 'DI'],
      linhas: [['3.85.23', '3.85.19']],
    },
  ],
}

describe('EditorDaFicha', () => {
  it('mostra as 5 opções fixas, sem adicionar, remover nem renomear', () => {
    render(
      <EditorDaFicha
        inicial={completarFicha(undefined)}
        aoSalvar={vi.fn()}
        aoCancelar={vi.fn()}
      />,
    )
    expect(
      screen.getAllByRole('group').map((g) => g.textContent?.slice(0, 40)),
    ).toHaveLength(5)
    for (const t of [
      'Compatibilidade DI',
      'Compatibilidade SmartShare',
      'Instaladores e Aplicativos',
      'Release Notes',
      'Contato',
    ]) {
      expect(screen.getByText(t, { selector: 'legend' })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Subir|Descer/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tabela' })).toBeNull()
    expect(screen.queryByLabelText('Título')).toBeNull()
  })

  it('edita a tabela em texto e salva com as linhas novas', async () => {
    const aoSalvar = vi.fn(async () => undefined)
    render(
      <EditorDaFicha
        inicial={salva}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Tabela de Compatibilidade DI/), {
      target: {
        value: 'SmartShare | DI\n3.86.7 | **3.86.7**\n3.85.23 | 3.85.19',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1))
    const enviada = (aoSalvar.mock.calls[0] as unknown as [Ficha])[0]
    expect(enviada.secoes).toHaveLength(5)
    expect(enviada.secoes[0]).toMatchObject({
      tipo: 'tabela',
      colunas: ['SmartShare', 'DI'],
      linhas: [
        ['3.86.7', '**3.86.7**'],
        ['3.85.23', '3.85.19'],
      ],
    })
  })

  it('edita os links de uma opção', async () => {
    const aoSalvar = vi.fn(async () => undefined)
    render(
      <EditorDaFicha
        inicial={completarFicha(undefined)}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Links de Release Notes/), {
      target: { value: 'SmartShare 4 | https://exemplo.com/ss4' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }))
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled())
    const enviada = (aoSalvar.mock.calls[0] as unknown as [Ficha])[0]
    expect(enviada.secoes[3]).toMatchObject({
      itens: [{ rotulo: 'SmartShare 4', url: 'https://exemplo.com/ss4' }],
    })
  })

  it('mostra o erro de gravação', async () => {
    const aoSalvar = vi.fn(async () => {
      throw new Error('Sem permissão')
    })
    render(
      <EditorDaFicha
        inicial={salva}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar informações' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão')
  })
})
