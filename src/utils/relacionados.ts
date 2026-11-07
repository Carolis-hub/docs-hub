import type { IndexedItem } from '../types/search'
import type { SearchEngine } from './searchEngine'

interface Base {
  id: string
  titulo: string
  resumo: string
  blockId: string
  productId: string
  categoria?: string
}

/**
 * Documentações relacionadas: os artigos do mesmo produto que mais se parecem
 * com este (busca pelo título e resumo), com um empurrão para os do mesmo
 * bloco e da mesma categoria. O próprio artigo nunca entra.
 */
export function relacionados(
  motor: SearchEngine,
  base: Base,
  limite = 5,
): IndexedItem[] {
  // Palavras curtas ("de", "o", "em") casariam com quase tudo: ficam de fora.
  const consulta = `${base.titulo} ${base.resumo}`
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4)
    .join(' ')
  if (!consulta) return []
  return motor
    .buscar(consulta, { productId: base.productId, combinar: 'OR' })
    .filter((h) => h.item.id !== base.id)
    .map((h) => ({
      item: h.item,
      pontos:
        h.score *
        (1 + (h.item.blockId === base.blockId ? 0.3 : 0)) *
        (1 + (base.categoria && h.item.categoria === base.categoria ? 0.2 : 0)),
    }))
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map((r) => r.item)
}
