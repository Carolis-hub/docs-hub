import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SecaoFicha } from '../types/content'
import { ValorDaOpcao } from './ValorDaOpcao'

const tabela: SecaoFicha = {
  id: 'compatibilidade-di',
  tipo: 'tabela',
  titulo: 'Compatibilidade DI',
  texto: 'Em **negrito** as versões homologadas.',
  colunas: ['SmartShare', 'DI Client'],
  linhas: [['3.85.23', '**3.85.19**']],
}
const links: SecaoFicha = {
  id: 'release-notes',
  tipo: 'links',
  titulo: 'Release Notes',
  texto: '',
  itens: [{ rotulo: 'SmartShare', url: 'https://x.com' }],
}

describe('ValorDaOpcao', () => {
  it('mostra título, texto de apoio e tabela com a versão homologada em negrito', () => {
    render(<ValorDaOpcao secao={tabela} />)
    expect(
      screen.getByRole('heading', { name: 'Compatibilidade DI' }),
    ).toBeInTheDocument()
    expect(screen.getByText('negrito').tagName).toBe('STRONG')
    expect(within(screen.getByRole('table')).getByText('3.85.19').tagName).toBe(
      'STRONG',
    )
  })

  it('o mesmo campo mostra os links das outras opções', () => {
    render(<ValorDaOpcao secao={links} />)
    expect(
      screen.getByRole('heading', { name: 'Release Notes' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /SmartShare/ })).toHaveAttribute(
      'href',
      'https://x.com',
    )
  })

  it('opção sem valor: aviso diferente para o admin e para o leitor', () => {
    const vazia: SecaoFicha = { ...links, itens: [] }
    const { rerender } = render(<ValorDaOpcao secao={vazia} admin />)
    expect(screen.getByText(/Use "Editar informações"/)).toBeInTheDocument()
    rerender(<ValorDaOpcao secao={vazia} />)
    expect(screen.getByText('Sem conteúdo por enquanto.')).toBeInTheDocument()
  })
})
