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
  /** Produtos cujo índice será carregado (na tela, só o produto em contexto). */
  productIds: string[]
  /** Admins e leitores com `verTecnico` enxergam artigos técnicos. */
  verTecnico: boolean
}

export { criarMotor }

// Cada escopo (em geral, um produto) é carregado uma única vez por sessão
// (aba): voltar a um produto já consultado não lê o índice de novo.
const motores = new Map<string, Promise<SearchEngine>>()

export function carregarMotor(escopo: SearchScope): Promise<SearchEngine> {
  const chave = `${escopo.verTecnico}|${[...escopo.productIds].sort().join(',')}`
  let motor = motores.get(chave)
  if (!motor) {
    motor = Promise.all(
      escopo.productIds.map((p) => lerIndiceDoProduto(p, escopo.verTecnico)),
    )
      .then((listas) => criarMotor(listas.flat(), escopo.verTecnico))
      .catch((e: unknown) => {
        motores.delete(chave)
        throw e
      })
    motores.set(chave, motor)
  }
  return motor
}

/** Descarta os motores em memória, para recarregar após publicar ou editar. */
export function invalidarCacheBusca(): void {
  motores.clear()
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
