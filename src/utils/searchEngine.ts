import MiniSearch from 'minisearch'
import type { ArticlePublico } from '../types/content'
import type { IndexedItem } from '../types/search'
import { normalizar } from './search'

export interface SearchFilters {
  productId?: string
  publico?: ArticlePublico
  /** Padrão `AND`; `OR` serve para consultas longas (ex.: casar um texto com artigos). */
  combinar?: 'AND' | 'OR'
}

export interface SearchHit {
  item: IndexedItem
  score: number
  /** Termos do texto que casaram, para destacar o trecho. */
  termos: string[]
}

export interface SearchEngine {
  total: number
  buscar(consulta: string, filtros?: SearchFilters): SearchHit[]
}

export function criarMotor(
  itens: IndexedItem[],
  verTecnico: boolean,
): SearchEngine {
  const visiveis = itens.filter((i) => verTecnico || i.publico !== 'tecnico')
  const mini = new MiniSearch<IndexedItem>({
    fields: ['titulo', 'resumo', 'textoPlano'],
    storeFields: ['id'],
    processTerm: (termo) => normalizar(termo),
    searchOptions: {
      boost: { titulo: 4, resumo: 1.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
      processTerm: (termo) => normalizar(termo),
    },
  })
  mini.addAll(visiveis)
  const porId = new Map(visiveis.map((i) => [i.id, i]))

  return {
    total: visiveis.length,
    buscar(consulta, filtros = {}) {
      if (!consulta.trim()) return []
      return mini
        .search(consulta, {
          combineWith: filtros.combinar ?? 'AND',
          filter: (r) => {
            const item = porId.get(r.id as string)
            if (!item) return false
            if (filtros.productId && item.productId !== filtros.productId) {
              return false
            }
            return !filtros.publico || item.publico === filtros.publico
          },
        })
        .map((r) => ({
          item: porId.get(r.id as string) as IndexedItem,
          score: r.score,
          termos: Object.keys(r.match),
        }))
    },
  }
}
