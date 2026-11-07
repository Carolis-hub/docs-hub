import MiniSearch from 'minisearch'
import type { ArticlePublico, CategoriaId } from '../types/content'
import type { IndexedItem } from '../types/search'
import { normalizar } from './search.ts'

export interface SearchFilters {
  productId?: string
  /** Vários produtos de uma vez (ex.: todos os de uma unidade de negócio). */
  productIds?: readonly string[]
  /** Só artigos destes blocos (ex.: um subproduto e tudo dentro dele). */
  blockIds?: ReadonlySet<string>
  categoria?: CategoriaId
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
  /** Navegação sem texto: todos os artigos que passam nos filtros, de A a Z. */
  listar(filtros?: SearchFilters): IndexedItem[]
}

function passa(item: IndexedItem, f: SearchFilters): boolean {
  if (f.productId && item.productId !== f.productId) return false
  if (f.productIds && !f.productIds.includes(item.productId)) return false
  if (f.blockIds && !f.blockIds.has(item.blockId)) return false
  if (f.categoria && item.categoria !== f.categoria) return false
  return !f.publico || item.publico === f.publico
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
    listar(filtros = {}) {
      return visiveis
        .filter((i) => passa(i, filtros))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    },
    buscar(consulta, filtros = {}) {
      if (!consulta.trim()) return []
      return mini
        .search(consulta, {
          combineWith: filtros.combinar ?? 'AND',
          filter: (r) => {
            const item = porId.get(r.id as string)
            return !!item && passa(item, filtros)
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
