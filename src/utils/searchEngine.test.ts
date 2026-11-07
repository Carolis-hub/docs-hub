import { describe, expect, it } from 'vitest'
import type { IndexedItem } from '../types/search'
import { criarMotor } from './searchEngine'
import { itemDoArtigo } from './searchIndex'

const item = (id: string, extra: Partial<IndexedItem> = {}): IndexedItem => ({
  id,
  titulo: `Artigo ${id}`,
  resumo: '',
  textoPlano: 'configurar o envio de relatório',
  blockId: 'b1',
  publico: 'usuario',
  productId: 'p1',
  ...extra,
})

const itens: IndexedItem[] = [
  item('a', { titulo: 'Zebra', categoria: 'processos', blockId: 'b1' }),
  item('b', { titulo: 'Abelha', categoria: 'configuracoes', blockId: 'b2' }),
  item('c', { productId: 'p2', categoria: 'processos', blockId: 'b3' }),
  item('d', { productId: 'p3', publico: 'tecnico', blockId: 'b4' }),
]

describe('motor de busca: filtros', () => {
  const motor = criarMotor(itens, true)
  const ids = (hits: Array<{ item: IndexedItem }>) =>
    hits.map((h) => h.item.id).sort()

  it('filtra por categoria', () => {
    expect(ids(motor.buscar('relatório', { categoria: 'processos' }))).toEqual([
      'a',
      'c',
    ])
  })

  it('filtra por vários produtos (uma unidade de negócio)', () => {
    expect(
      ids(motor.buscar('relatório', { productIds: ['p1', 'p2'] })),
    ).toEqual(['a', 'b', 'c'])
    expect(ids(motor.buscar('relatório', { productIds: [] }))).toEqual([])
  })

  it('filtra por blocos (um subproduto e o que há dentro dele)', () => {
    expect(
      ids(motor.buscar('relatório', { blockIds: new Set(['b2', 'b3']) })),
    ).toEqual(['b', 'c'])
  })

  it('combina os filtros', () => {
    const f = {
      productIds: ['p1', 'p2'],
      categoria: 'processos',
      blockIds: new Set(['b1']),
    } as const
    expect(ids(motor.buscar('relatório', f))).toEqual(['a'])
  })

  it('o filtro de produto único continua valendo', () => {
    expect(ids(motor.buscar('relatório', { productId: 'p2' }))).toEqual(['c'])
  })
})

describe('motor de busca: listar (navegação sem texto)', () => {
  it('lista de A a Z o que passa nos filtros, sem precisar de texto', () => {
    const motor = criarMotor(itens, true)
    expect(motor.listar({ productId: 'p1' }).map((i) => i.titulo)).toEqual([
      'Abelha',
      'Zebra',
    ])
    expect(motor.listar({ categoria: 'processos' }).map((i) => i.id)).toEqual([
      'c',
      'a',
    ])
    expect(motor.listar().length).toBe(4)
  })

  it('não lista o que o leitor não pode ver (técnico sem permissão)', () => {
    const motor = criarMotor(itens, false)
    expect(motor.listar().map((i) => i.id)).not.toContain('d')
    expect(motor.total).toBe(3)
  })
})

describe('itemDoArtigo', () => {
  const base = {
    id: 'x',
    titulo: 'T',
    resumo: 'r',
    textoPlano: 't',
    blockId: 'b',
    publico: 'usuario' as const,
  }

  it('grava a categoria no índice só quando existe', () => {
    expect(itemDoArtigo({ ...base, categoria: 'processos' }).categoria).toBe(
      'processos',
    )
    expect('categoria' in itemDoArtigo({ ...base, categoria: '' })).toBe(false)
    expect('categoria' in itemDoArtigo(base)).toBe(false)
  })
})
