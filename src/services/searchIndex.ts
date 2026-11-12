import {
  collection,
  doc,
  getDoc,
  getDocs,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore'
import type { Block } from '../types/content'
import type { IndexedItem, SearchItem } from '../types/search'
import {
  COLECAO_INDICE,
  COLECAO_INDICE_TECNICO,
  COLECOES_INDICE,
  INDEX_LIMITE_BYTES,
  PARTE_RAIZ,
  aplicarItem,
  caberNoLimite,
  colecaoDoPublico,
  dividirPorParte,
  itemDoArtigo,
  juntarColecoes,
  parteDoBloco,
  tamanhoBytes,
  type ColecaoIndice,
} from '../utils/searchIndex'
import { listProductTree } from './blocks'
import { db } from './firebase'

interface IndexDoc {
  itens?: SearchItem[]
  /** `true` quando o índice foi dividido em `partes/{subprodutoId}`. */
  dividido?: boolean
}

const indexRef = (colecao: ColecaoIndice, productId: string) =>
  doc(db, colecao, productId)
const parteRef = (colecao: ColecaoIndice, productId: string, parteId: string) =>
  doc(db, colecao, productId, 'partes', parteId)

type Escrita = [DocumentReference, IndexDoc]

/**
 * Lê o que for preciso de uma das coleções do índice e devolve as escritas a
 * fazer (nenhuma, se o artigo não está lá e não deve entrar).
 */
async function planejar(
  tx: Transaction,
  colecao: ColecaoIndice,
  productId: string,
  blockId: string,
  articleId: string,
  item: SearchItem | null,
  arvoreDoProduto: () => Promise<Block[]>,
): Promise<Escrita[]> {
  const principal = await tx.get(indexRef(colecao, productId))
  const dados = (principal.data() ?? {}) as IndexDoc
  const ausente = (itens: SearchItem[]) =>
    item === null && !itens.some((i) => i.id === articleId)

  if (!dados.dividido) {
    const atuais = dados.itens ?? []
    if (ausente(atuais)) return []
    const itens = aplicarItem(atuais, articleId, item)
    if (tamanhoBytes({ itens }) <= INDEX_LIMITE_BYTES) {
      return [[indexRef(colecao, productId), { itens }]]
    }
    // Estourou o limite: distribui tudo por subproduto.
    const arvore = await arvoreDoProduto()
    const partes = dividirPorParte(itens, (b) => parteDoBloco(arvore, b))
    return [
      ...Object.entries(partes).map(([parteId, lista]): Escrita => [
        parteRef(colecao, productId, parteId),
        { itens: caberNoLimite(lista) },
      ]),
      [indexRef(colecao, productId), { itens: [], dividido: true }],
    ]
  }

  const arvore = await arvoreDoProduto()
  const parteId = parteDoBloco(arvore, blockId) || PARTE_RAIZ
  const parte = await tx.get(parteRef(colecao, productId, parteId))
  const atuais = ((parte.data() ?? {}) as IndexDoc).itens ?? []
  if (ausente(atuais)) return []
  return [
    [
      parteRef(colecao, productId, parteId),
      { itens: caberNoLimite(aplicarItem(atuais, articleId, item)) },
    ],
  ]
}

/**
 * Insere, atualiza (`item`) ou remove (`item === null`) um artigo no índice do
 * produto, dentro da transação. O artigo fica na coleção do seu público (comum
 * ou técnica) e sai da outra, para o caso de o público ter mudado. Todas as
 * leituras acontecem antes das escritas do índice, então chame antes de
 * escrever o próprio artigo. Se um documento se aproximar de 1 MiB, o índice
 * daquela coleção é dividido por subproduto.
 */
export async function atualizarIndiceTx(
  tx: Transaction,
  productId: string,
  blockId: string,
  articleId: string,
  item: SearchItem | null,
): Promise<void> {
  let arvore: Promise<Block[]> | null = null
  const arvoreDoProduto = () => (arvore ??= listProductTree(productId))
  const destino = item ? colecaoDoPublico(item.publico) : null

  const escritas: Escrita[] = []
  for (const colecao of COLECOES_INDICE) {
    escritas.push(
      ...(await planejar(
        tx,
        colecao,
        productId,
        blockId,
        articleId,
        colecao === destino ? item : null,
        arvoreDoProduto,
      )),
    )
  }
  for (const [ref, dados] of escritas) tx.set(ref, dados)
}

async function lerColecao(
  colecao: ColecaoIndice,
  productId: string,
): Promise<SearchItem[]> {
  const principal = await getDoc(indexRef(colecao, productId))
  if (!principal.exists()) return []
  const dados = principal.data() as IndexDoc
  if (!dados.dividido) return dados.itens ?? []
  const partes = await getDocs(collection(db, colecao, productId, 'partes'))
  return partes.docs.flatMap((p) => (p.data() as IndexDoc).itens ?? [])
}

/**
 * Lê o índice de um produto (principal + partes, se houver). A parte técnica
 * só é pedida para quem pode vê-la: as regras negariam a leitura aos demais.
 */
export async function lerIndiceDoProduto(
  productId: string,
  verTecnico: boolean,
): Promise<IndexedItem[]> {
  const [comuns, tecnicos] = await Promise.all([
    lerColecao(COLECAO_INDICE, productId),
    verTecnico ? lerColecao(COLECAO_INDICE_TECNICO, productId) : null,
  ])
  return juntarColecoes(comuns, tecnicos).map((i) => ({ ...i, productId }))
}

export { itemDoArtigo }
