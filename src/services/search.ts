import MiniSearch from 'minisearch'
import { doc, increment, setDoc } from 'firebase/firestore'
import type { ArticlePublico } from '../types/content'
import type { IndexedItem } from '../types/search'
import { normalizar } from '../utils/search'
import { slugify } from '../utils/slug'
import { db } from './firebase'
import { lerIndiceDoProduto } from './searchIndex'

export interface SearchFilters {
  productId?: string
  publico?: ArticlePublico
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

export interface SearchScope {
  /** Produtos cujo índice será carregado. */
  productIds: string[]
  /** Admins e leitores com `verTecnico` enxergam artigos técnicos. */
  verTecnico: boolean
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

// Os índices são carregados uma única vez por sessão (aba).
let motor: Promise<SearchEngine> | null = null
let chave = ''

export function carregarMotor(escopo: SearchScope): Promise<SearchEngine> {
  const nova = `${escopo.verTecnico}|${[...escopo.productIds].sort().join(',')}`
  if (!motor || chave !== nova) {
    chave = nova
    motor = Promise.all(escopo.productIds.map(lerIndiceDoProduto))
      .then((listas) => criarMotor(listas.flat(), escopo.verTecnico))
      .catch((e: unknown) => {
        motor = null
        throw e
      })
  }
  return motor
}

/** Descarta o motor em memória, para recarregar após publicar ou editar. */
export function invalidarCacheBusca(): void {
  motor = null
  chave = ''
}

const jaRegistradas = new Set<string>()

/** Contador agregado de buscas sem resultado, uma vez por termo e sessão. */
export async function registrarBuscaSemResultado(
  consulta: string,
): Promise<void> {
  const termo = normalizar(consulta).replace(/\s+/g, ' ').trim().slice(0, 100)
  const id = slugify(termo).slice(0, 100)
  if (!id || jaRegistradas.has(id)) return
  jaRegistradas.add(id)
  try {
    await setDoc(
      doc(db, 'searchMisses', id),
      { termo, count: increment(1), ultimaVez: Date.now() },
      { merge: true },
    )
  } catch {
    // Métrica é opcional: falha de rede ou de regra não deve afetar a busca.
  }
}
