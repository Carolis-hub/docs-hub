import type { Block, Unidade } from '../types/content'

export interface Grupo {
  chave: string
  unidade: Unidade | null
  produtos: Block[]
}

/** Agrupa os produtos por unidade; produtos sem unidade vão para o fim. */
export function agruparPorUnidade(
  produtos: Block[],
  unidades: Unidade[],
  incluirVazias: boolean,
): Grupo[] {
  const grupos: Grupo[] = unidades.map((u) => ({
    chave: u.id,
    unidade: u,
    produtos: produtos.filter((p) => p.unidadeId === u.id),
  }))
  const ids = new Set(unidades.map((u) => u.id))
  const soltos = produtos.filter((p) => !p.unidadeId || !ids.has(p.unidadeId))
  if (soltos.length > 0) {
    grupos.push({ chave: 'sem-unidade', unidade: null, produtos: soltos })
  }
  return grupos.filter((g) => incluirVazias || g.produtos.length > 0)
}
