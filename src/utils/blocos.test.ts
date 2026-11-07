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
