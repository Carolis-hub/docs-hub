import { describe, expect, it } from 'vitest'
import { CATEGORIAS, nomeDaCategoria } from './categorias'

describe('categorias', () => {
  it('traz as quatro categorias da documentação funcional', () => {
    expect(CATEGORIAS.map((c) => c.nome)).toEqual([
      'Funcionalidades',
      'Configurações',
      'Processos',
      'Regras de negócio',
    ])
  })

  it('devolve o nome pelo id e ignora ids desconhecidos ou vazios', () => {
    expect(nomeDaCategoria('processos')).toBe('Processos')
    expect(nomeDaCategoria('')).toBeUndefined()
    expect(nomeDaCategoria(undefined)).toBeUndefined()
    expect(nomeDaCategoria('outra')).toBeUndefined()
  })
})
