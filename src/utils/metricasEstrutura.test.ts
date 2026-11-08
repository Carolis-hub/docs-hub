import { describe, expect, it } from 'vitest'
import type { Article, Block, Unidade } from '../types/content'
import { metricasDaEstrutura } from './metricasEstrutura'

const b = (
  id: string,
  parentId: string | null,
  productId: string,
  unidadeId?: string,
) => ({ id, nome: id, parentId, productId, unidadeId }) as Block
const u = (id: string) => ({ id, nome: id.toUpperCase() }) as Unidade
const agora = new Date(2026, 10, 15)
const a = (
  id: string,
  productId: string,
  blockId: string,
  extra: Partial<Article> = {},
) =>
  ({
    id,
    productId,
    blockId,
    status: 'published',
    views: 10,
    atualizadoEm: new Date(2026, 10, 3).getTime(),
    revisadoEm: new Date(2026, 10, 3).getTime(),
    ...extra,
  }) as Article

// u1: produto p1 > sub s1 > módulos m1 (com artigo) e m2 (sem); u2: produto p2 (sem subs)
const blocos = [
  b('p1', null, 'p1', 'u1'),
  b('s1', 'p1', 'p1'),
  b('m1', 's1', 'p1'),
  b('m2', 's1', 'p1'),
  b('p2', null, 'p2', 'u2'),
]
const unidades = [u('u1'), u('u2')]

describe('metricasDaEstrutura', () => {
  const artigos = [
    a('1', 'p1', 'm1'),
    a('2', 'p1', 's1', { revisadoEm: new Date(2025, 0, 1).getTime() }),
    a('3', 'p2', 'p2', { status: 'draft' }),
  ]

  it('conta a estrutura, a cobertura e os artigos', () => {
    const m = metricasDaEstrutura(blocos, unidades, artigos, '', agora)
    expect(m.unidades).toBe(2)
    expect(m.produtos).toBe(2)
    expect(m.subprodutos).toBe(1)
    expect(m.modulos).toBe(2)
    expect(m.modulosDocumentados).toBe(1)
    expect(m.cobertura).toBe(50)
    expect(m.publicados).toBe(2)
    expect(m.rascunhos).toBe(1)
    expect(m.visualizacoes).toBe(30)
    expect(m.desatualizados).toBe(1)
  })

  it('agrupa por unidade, por produto e por mês', () => {
    const m = metricasDaEstrutura(blocos, unidades, artigos, '', agora)
    expect(m.porUnidade).toEqual([
      { id: 'u1', nome: 'U1', total: 2 },
      { id: 'u2', nome: 'U2', total: 0 },
    ])
    expect(m.porProduto[0]).toMatchObject({ id: 'p1', total: 2 })
    expect(m.porMes).toHaveLength(12)
    expect(m.porMes[11]).toMatchObject({ rotulo: 'nov', total: 2 })
    expect(m.porMes.reduce((s, x) => s + x.total, 0)).toBe(2)
  })

  it('filtra por unidade', () => {
    const m = metricasDaEstrutura(blocos, unidades, artigos, 'u2', agora)
    expect(m.unidades).toBe(1)
    expect(m.produtos).toBe(1)
    expect(m.modulos).toBe(0)
    expect(m.cobertura).toBeNull()
    expect(m.artigos).toBe(1)
  })
})
