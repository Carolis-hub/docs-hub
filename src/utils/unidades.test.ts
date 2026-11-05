import { describe, expect, it } from 'vitest'
import type { Block, Unidade } from '../types/content'
import { agruparPorUnidade } from './unidades'

const unidade = (id: string, ordem: number): Unidade => ({
  id,
  nome: id.toUpperCase(),
  slug: id,
  descricao: '',
  icone: '',
  ordem,
})
const produto = (id: string, unidadeId?: string | null): Block => ({
  id,
  nome: id,
  slug: id,
  descricao: '',
  icone: '',
  ordem: 0,
  parentId: null,
  productId: id,
  unidadeId,
})

describe('agruparPorUnidade', () => {
  const unidades = [unidade('ps', 0), unidade('outra', 1)]
  const produtos = [
    produto('ss4', 'ps'),
    produto('solto'),
    produto('apagada', 'nao-existe'),
  ]

  it('agrupa por unidade e manda os sem unidade (ou de unidade inexistente) para o fim', () => {
    const grupos = agruparPorUnidade(produtos, unidades, true)
    expect(grupos.map((g) => [g.chave, g.produtos.map((p) => p.id)])).toEqual([
      ['ps', ['ss4']],
      ['outra', []],
      ['sem-unidade', ['solto', 'apagada']],
    ])
  })

  it('o leitor não vê unidades vazias', () => {
    const grupos = agruparPorUnidade(produtos, unidades, false)
    expect(grupos.map((g) => g.chave)).toEqual(['ps', 'sem-unidade'])
  })

  it('sem produtos soltos não cria o grupo "sem unidade"', () => {
    const grupos = agruparPorUnidade([produto('ss4', 'ps')], unidades, true)
    expect(grupos.map((g) => g.chave)).toEqual(['ps', 'outra'])
  })
})
