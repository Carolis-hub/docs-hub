import { describe, expect, it } from 'vitest'
import type { Block } from '../types/content'
import { comDescendentes } from './blocos'

const bloco = (id: string, parentId: string | null): Block => ({
  id,
  nome: id,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId,
  productId: 'p',
})

describe('comDescendentes', () => {
  const arvore = [
    bloco('p', null),
    bloco('a', 'p'),
    bloco('a1', 'a'),
    bloco('a1x', 'a1'),
    bloco('b', 'p'),
  ]

  it('inclui o bloco e todos os níveis abaixo dele', () => {
    expect([...comDescendentes(arvore, 'a')].sort()).toEqual(['a', 'a1', 'a1x'])
    expect([...comDescendentes(arvore, 'b')]).toEqual(['b'])
  })

  it('não entra em laço se a árvore estiver corrompida', () => {
    const laco = [bloco('x', 'y'), bloco('y', 'x')]
    expect([...comDescendentes(laco, 'x')].sort()).toEqual(['x', 'y'])
  })
})

describe('tipos de nível', () => {
  it('nomeia os níveis pela profundidade', async () => {
    const { tipoDoNivel, tipoDosFilhos } = await import('./blocos')
    expect(tipoDoNivel(0)).toBe('Produto')
    expect(tipoDoNivel(2)).toBe('Módulo')
    expect(tipoDoNivel(5)).toBe('Seção')
    expect(tipoDosFilhos(0)).toEqual({
      singular: 'Subproduto',
      plural: 'Subprodutos',
      artigoNovo: 'Novo subproduto',
    })
    expect(tipoDosFilhos(1).plural).toBe('Módulos')
    expect(tipoDosFilhos(2).plural).toBe('Seções')
  })
})
