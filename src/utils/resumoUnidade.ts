import type { Block } from '../types/content'

export interface ResumoUnidade {
  produtos: number
  artigos: number
}

/** Soma produtos e artigos publicados dos produtos de uma unidade. */
export function resumirUnidade(
  produtos: Block[],
  artigos: Record<string, number>,
): ResumoUnidade {
  return {
    produtos: produtos.length,
    artigos: produtos.reduce((soma, p) => soma + (artigos[p.id] ?? 0), 0),
  }
}

export const pluralizar = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`
