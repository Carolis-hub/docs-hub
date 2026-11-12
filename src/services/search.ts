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
  /** Sinônimos do produto (grupos de termos normalizados). */
  sinonimos?: string[][]
}

export { criarMotor }

// Cada escopo (em geral, um produto) é carregado uma única vez por sessão
// (aba): voltar a um produto já consultado não lê o índice de novo.
const motores = new Map<string, Promise<SearchEngine>>()

export function carregarMotor(escopo: SearchScope): Promise<SearchEngine> {
  const sinonimos = escopo.sinonimos ?? []
  const chave = `${escopo.verTecnico}|${[...escopo.productIds].sort().join(',')}|${JSON.stringify(sinonimos)}`
  let motor = motores.get(chave)
  if (!motor) {
    motor = Promise.all(
      escopo.productIds.map((p) => lerIndiceDoProduto(p, escopo.verTecnico)),
    )
      .then((listas) =>
        criarMotor(listas.flat(), escopo.verTecnico, { sinonimos }),
      )
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

/** Termo como fica no relatório, e o id do contador (por produto). */
function chaveDoTermo(consulta: string, productId: string) {
  const termo = normalizar(consulta).replace(/\s+/g, ' ').trim().slice(0, 100)
  const slug = slugify(termo).slice(0, 100)
  return { termo, id: slug ? `${productId}__${slug}` : '' }
}

/** Contador agregado de buscas sem resultado, uma vez por termo e sessão. */
export async function registrarBuscaSemResultado(
  consulta: string,
  productId: string,
): Promise<void> {
  const { termo, id } = chaveDoTermo(consulta, productId)
  if (!id || !productId || jaRegistradas.has(id)) return
  jaRegistradas.add(id)
  try {
    await setDoc(
      doc(db, 'searchMisses', id),
      { termo, productId, count: increment(1), ultimaVez: Date.now() },
      { merge: true },
    )
  } catch {
    // Métrica é opcional: falha de rede ou de regra não deve afetar a busca.
  }
}

const jaAvaliadas = new Set<string>()

/** `true` se a pessoa já respondeu "ajudou?" para este termo nesta sessão. */
export function jaAvaliouBusca(consulta: string, productId: string): boolean {
  return jaAvaliadas.has(chaveDoTermo(consulta, productId).id)
}

/**
 * "Esta busca ajudou?": soma um voto (sim ou não) no contador do termo e do
 * produto. Não guarda quem votou. Um voto por termo e sessão.
 */
export async function registrarRetornoDaBusca(
  consulta: string,
  productId: string,
  ajudou: boolean,
): Promise<void> {
  const { termo, id } = chaveDoTermo(consulta, productId)
  if (!id || !productId || jaAvaliadas.has(id)) return
  jaAvaliadas.add(id)
  try {
    await setDoc(
      doc(db, 'searchFeedback', id),
      {
        termo,
        productId,
        sim: increment(ajudou ? 1 : 0),
        nao: increment(ajudou ? 0 : 1),
        ultimaVez: Date.now(),
      },
      { merge: true },
    )
  } catch {
    // Métrica é opcional: falha de rede ou de regra não deve afetar a busca.
  }
}
