import { describe, expect, it } from 'vitest'
import type { Block } from '../types/content'
import { pluralizar, resumirUnidade } from './resumoUnidade'

const p = (id: string) => ({ id }) as Block

describe('resumoUnidade', () => {
  it('soma produtos e artigos', () => {
    expect(resumirUnidade([p('a'), p('b')], { a: 3, b: 4, c: 9 })).toEqual({
      produtos: 2,
      artigos: 7,
    })
  })
  it('trata produto sem contagem como zero', () => {
    expect(resumirUnidade([p('a')], {})).toEqual({ produtos: 1, artigos: 0 })
  })
  it('pluraliza', () => {
    expect(pluralizar(1, 'produto', 'produtos')).toBe('1 produto')
    expect(pluralizar(0, 'artigo', 'artigos')).toBe('0 artigos')
  })
})
