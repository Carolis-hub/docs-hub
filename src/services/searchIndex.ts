import {
  collection,
  doc,
  getDoc,
  getDocs,
  type Transaction,
} from 'firebase/firestore'
import type { Article } from '../types/content'
import type { IndexedItem, SearchItem } from '../types/search'
import {
  INDEX_LIMITE_BYTES,
  PARTE_RAIZ,
  aplicarItem,
  dividirPorParte,
  parteDoBloco,
  tamanhoBytes,
  truncarTexto,
} from '../utils/searchIndex'
import { listProductTree } from './blocks'
import { db } from './firebase'

interface IndexDoc {
  itens?: SearchItem[]
  /** `true` quando o índice foi dividido em `partes/{subprodutoId}`. */
  dividido?: boolean
}

export function itemDoArtigo(
  a: Pick<
    Article,
    'titulo' | 'resumo' | 'textoPlano' | 'blockId' | 'publico'
  > & { id: string },
): SearchItem {
  return {
    id: a.id,
    titulo: a.titulo,
    resumo: a.resumo,
    textoPlano: truncarTexto(a.textoPlano),
    blockId: a.blockId,
    publico: a.publico,
  }
}

const indexRef = (productId: string) => doc(db, 'searchIndex', productId)
const parteRef = (productId: string, parteId: string) =>
  doc(db, 'searchIndex', productId, 'partes', parteId)

/**
 * Insere, atualiza (`item`) ou remove (`item === null`) um artigo no índice do
 * produto, dentro da transação. Todas as leituras acontecem antes das escritas
 * do índice, então chame antes de escrever o próprio artigo. Se o documento
 * principal se aproximar de 1 MiB, divide o índice por subproduto.
 */
export async function atualizarIndiceTx(
  tx: Transaction,
  productId: string,
  blockId: string,
  articleId: string,
  item: SearchItem | null,
): Promise<void> {
  const principal = await tx.get(indexRef(productId))
  const dados = (principal.data() ?? {}) as IndexDoc

  if (!dados.dividido) {
    const itens = aplicarItem(dados.itens ?? [], articleId, item)
    if (tamanhoBytes({ itens }) <= INDEX_LIMITE_BYTES) {
      tx.set(indexRef(productId), { itens })
      return
    }
    // Estourou o limite: distribui tudo por subproduto.
    const arvore = await listProductTree(productId)
    const partes = dividirPorParte(itens, (b) => parteDoBloco(arvore, b))
    for (const [parteId, lista] of Object.entries(partes)) {
      tx.set(parteRef(productId, parteId), { itens: lista })
    }
    tx.set(indexRef(productId), { itens: [], dividido: true })
    return
  }

  const arvore = await listProductTree(productId)
  const parteId = parteDoBloco(arvore, blockId) || PARTE_RAIZ
  const parte = await tx.get(parteRef(productId, parteId))
  const atuais = ((parte.data() ?? {}) as IndexDoc).itens ?? []
  tx.set(parteRef(productId, parteId), {
    itens: aplicarItem(atuais, articleId, item),
  })
}

/** Lê o índice completo de um produto (principal + partes, se houver). */
export async function lerIndiceDoProduto(
  productId: string,
): Promise<IndexedItem[]> {
  const principal = await getDoc(indexRef(productId))
  if (!principal.exists()) return []
  const dados = principal.data() as IndexDoc
  let itens = dados.itens ?? []
  if (dados.dividido) {
    const partes = await getDocs(
      collection(db, 'searchIndex', productId, 'partes'),
    )
    itens = partes.docs.flatMap((p) => (p.data() as IndexDoc).itens ?? [])
  }
  return itens.map((i) => ({ ...i, productId }))
}
