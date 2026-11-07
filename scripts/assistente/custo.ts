/** Tokens gastos numa chamada à IA (a API informa cada tipo separado). */
export interface UsoIA {
  modelo: string
  entrada: number
  saida: number
  cacheLeitura: number
  cacheEscrita: number
}

/** Preço em dólares por milhão de tokens. Confira em docs.claude.com antes de depender. */
interface Preco {
  entrada: number
  saida: number
}

const PRECOS: Record<string, Preco> = {
  'claude-fable-5-1': { entrada: 10, saida: 50 },
  'claude-fable-5': { entrada: 10, saida: 50 },
  'claude-opus-5-5': { entrada: 4, saida: 20 },
  'claude-opus-5': { entrada: 5, saida: 25 },
  'claude-opus-4-8': { entrada: 5, saida: 25 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-sonnet-5': { entrada: 2, saida: 10 },
  'claude-sonnet-4-6': { entrada: 3, saida: 15 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 },
  'claude-haiku-4-5': { entrada: 1, saida: 5 },
}

/** Modelo desconhecido: assume um preço alto, para o teto de gasto errar a favor da segurança. */
const PRECO_DESCONHECIDO: Preco = { entrada: 10, saida: 50 }

/**
 * Custo estimado em dólares. Leitura de cache custa 10% da entrada e escrita
 * 125%. É uma estimativa para o controle de gasto, não a fatura.
 */
export function custoEstimado(uso: UsoIA): number {
  const p = PRECOS[uso.modelo] ?? PRECO_DESCONHECIDO
  const total =
    uso.entrada * p.entrada +
    uso.saida * p.saida +
    uso.cacheLeitura * p.entrada * 0.1 +
    uso.cacheEscrita * p.entrada * 1.25
  return total / 1_000_000
}

export const somar = (usos: UsoIA[]) => ({
  entrada: usos.reduce(
    (t, u) => t + u.entrada + u.cacheLeitura + u.cacheEscrita,
    0,
  ),
  saida: usos.reduce((t, u) => t + u.saida, 0),
  custoUsd: usos.reduce((t, u) => t + custoEstimado(u), 0),
})
