import { doc, increment, setDoc } from 'firebase/firestore'
import { normalizar } from '../utils/search'
import { criarMotor, type SearchEngine } from '../utils/searchEngine'
import { slugify } from '../utils/slug'
import { db } from './firebase'
import { lerIndiceDoProduto } from './searchIndex'

export type {
  SearchEngine,
  SearchFilters,
  SearchHit,
} from '../utils/searchEngine'

export interface SearchScope {
  /** Produtos cujo índice será carregado. */
  productIds: string[]
  /** Admins e leitores com `verTecnico` enxergam artigos técnicos. */
  verTecnico: boolean
}

// Os índices são carregados uma única vez por sessão (aba).
export { criarMotor }

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
