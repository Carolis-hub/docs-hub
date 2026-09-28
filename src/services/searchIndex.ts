import {
  deleteField,
  doc,
  getDoc,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Article } from '../types/article'
import type { SearchIndexItem, SearchResultItem } from '../types/search'

const TEXTO_PLANO_MAX = 1000
// O plano do Spark tem cada documento limitado a 1 MiB; avisamos bem antes
// de chegar lá para dar tempo de dividir o índice por subproduto.
const TAMANHO_ALERTA_BYTES = 900 * 1024

function searchIndexRef(productId: string) {
  return doc(db, 'searchIndex', productId)
}

export function itemDoArtigo(article: Article): SearchIndexItem {
  return {
    id: article.id,
    titulo: article.titulo,
    resumo: article.resumo,
    textoPlano: article.textoPlano.slice(0, TEXTO_PLANO_MAX),
    blockId: article.blockId,
    publico: article.publico,
  }
}

/** Inclui/atualiza um artigo no índice do seu produto, na mesma transação da publicação. */
export function atualizarNaTransacao(
  transaction: Transaction,
  productId: string,
  item: SearchIndexItem,
): void {
  transaction.set(
    searchIndexRef(productId),
    { itens: { [item.id]: item } },
    { merge: true },
  )
}

/**
 * Remove um artigo do índice do seu produto, no mesmo batch da
 * despublicação/exclusão. Usa `set` com merge (em vez de `update`) porque
 * o documento searchIndex/{productId} pode não existir ainda — por
 * exemplo, ao excluir um artigo que nunca chegou a ser publicado.
 */
export function removerNoBatch(
  batch: WriteBatch,
  productId: string,
  articleId: string,
): void {
  batch.set(
    searchIndexRef(productId),
    { itens: { [articleId]: deleteField() } },
    { merge: true },
  )
}

/**
 * Verificação só informativa (não bloqueia a escrita): avisa no console se
 * um índice está perto do limite de 1 MiB do Firestore, para o time saber
 * que está na hora de dividir esse produto por subproduto (ver seção 7 do
 * PLAN.md). Não é chamada dentro da transação/batch para não gastar uma
 * leitura extra em todo publish/despublish.
 */
export async function avisarSeIndiceGrande(productId: string): Promise<void> {
  const snapshot = await getDoc(searchIndexRef(productId))
  if (!snapshot.exists()) return

  const tamanhoAproximado = JSON.stringify(snapshot.data()).length
  if (tamanhoAproximado > TAMANHO_ALERTA_BYTES) {
    console.warn(
      `searchIndex/${productId} está com ~${Math.round(tamanhoAproximado / 1024)} KB, perto do limite de 1 MiB do Firestore. Considere dividir esse produto por subproduto.`,
    )
  }
}

/** Carrega os índices dos produtos informados (um get por produto, com cache persistente do Firestore). */
export async function carregarIndices(
  productIds: string[],
): Promise<SearchResultItem[]> {
  const resultados = await Promise.all(
    productIds.map(async (productId) => {
      const snapshot = await getDoc(searchIndexRef(productId))
      if (!snapshot.exists()) return []

      const itens = (snapshot.data().itens ?? {}) as Record<
        string,
        SearchIndexItem
      >
      return Object.values(itens).map((item) => ({ ...item, productId }))
    }),
  )

  return resultados.flat()
}
