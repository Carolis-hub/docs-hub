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

describe('ordemCompleta', () => {
  const b = (id: string, ordem: number): Block => ({
    id,
    nome: id,
    slug: id,
    descricao: '',
    icone: '',
    ordem,
    parentId: null,
    productId: id,
  })

  it('com a lista inteira, devolve a nova ordem', async () => {
    const { ordemCompleta } = await import('./blocos')
    const todos = [b('a', 0), b('b', 1), b('c', 2)]
    expect(ordemCompleta(todos, [todos[2]!, todos[0]!, todos[1]!])).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('com um subconjunto, quem ficou de fora não sai do lugar', async () => {
    const { ordemCompleta } = await import('./blocos')
    const todos = [b('a', 0), b('x', 1), b('b', 2), b('y', 3), b('c', 4)]
    // a, b e c trocam entre si; x e y continuam nas posições 1 e 3.
    expect(ordemCompleta(todos, [todos[4]!, todos[2]!, todos[0]!])).toEqual([
      'c',
      'x',
      'b',
      'y',
      'a',
    ])
  })
})
