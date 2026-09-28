import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { slugify } from '../utils/slug'
import { registrarAuditLog } from './auditLog'
import type { Block, BlockInput } from '../types/block'

const blocksCollection = collection(db, 'blocks')

// Limite do operador "in" do Firestore.
const LIMITE_IN = 10

function toBlock(id: string, data: Record<string, unknown>): Block {
  return {
    id,
    nome: data.nome as string,
    slug: data.slug as string,
    descricao: (data.descricao as string) ?? '',
    icone: (data.icone as string) ?? '',
    ordem: (data.ordem as number) ?? 0,
    parentId: (data.parentId as string | null) ?? null,
    productId: data.productId as string,
  }
}

/**
 * Lista os produtos (blocos raiz). Para leitores, `produtosPermitidos` é
 * obrigatório: sem ele, a consulta é rejeitada pelo firestore.rules porque
 * a regra depende do campo `productId`, que a consulta precisa filtrar
 * explicitamente para provar que só retorna documentos permitidos.
 * Admins chamam sem esse argumento.
 */
export async function listProducts(
  produtosPermitidos?: string[],
): Promise<Block[]> {
  const condicoes = [where('parentId', '==', null)]
  if (produtosPermitidos) {
    condicoes.push(
      where('productId', 'in', produtosPermitidos.slice(0, LIMITE_IN)),
    )
  }
  const q = query(blocksCollection, ...condicoes, orderBy('ordem'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toBlock(docSnap.id, docSnap.data()))
}

/**
 * Lista os filhos de um bloco. Para leitores, `productId` (o do próprio
 * bloco pai, já verificado como permitido) precisa ser informado pelo
 * mesmo motivo de `listProducts`. Admins chamam sem esse argumento.
 */
export async function listChildren(
  parentId: string,
  productId?: string,
): Promise<Block[]> {
  const condicoes = [where('parentId', '==', parentId)]
  if (productId) {
    condicoes.push(where('productId', '==', productId))
  }
  const q = query(blocksCollection, ...condicoes, orderBy('ordem'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toBlock(docSnap.id, docSnap.data()))
}

/** Uso restrito a admins: lista todos os blocos, sem filtro de permissão. */
export async function listAllBlocks(): Promise<Block[]> {
  const snapshot = await getDocs(blocksCollection)
  return snapshot.docs.map((docSnap) => toBlock(docSnap.id, docSnap.data()))
}

export async function getBlock(id: string): Promise<Block | null> {
  const snapshot = await getDoc(doc(blocksCollection, id))
  if (!snapshot.exists()) return null
  return toBlock(snapshot.id, snapshot.data())
}

/** Monta a trilha de breadcrumb, da raiz até o bloco informado. */
export async function getBreadcrumb(blockId: string): Promise<Block[]> {
  const trilha: Block[] = []
  let atualId: string | null = blockId

  while (atualId) {
    const bloco = await getBlock(atualId)
    if (!bloco) break
    trilha.unshift(bloco)
    atualId = bloco.parentId
  }

  return trilha
}

export async function createBlock(
  input: BlockInput,
  autorId: string,
): Promise<string> {
  const siblings = input.parentId
    ? await listChildren(input.parentId)
    : await listProducts()
  const ordem = siblings.length

  const novoId = await runTransaction(db, async (transaction) => {
    const novoDocRef = doc(blocksCollection)
    let productId = novoDocRef.id

    if (input.parentId) {
      const parentSnap = await transaction.get(
        doc(blocksCollection, input.parentId),
      )
      if (!parentSnap.exists()) {
        throw new Error('Bloco pai não encontrado')
      }
      productId = parentSnap.data().productId as string
    }

    transaction.set(novoDocRef, {
      nome: input.nome,
      slug: slugify(input.nome),
      descricao: input.descricao,
      icone: input.icone,
      ordem,
      parentId: input.parentId,
      productId,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    })

    return novoDocRef.id
  })

  await registrarAuditLog(autorId, 'criar_bloco', novoId)
  return novoId
}

export async function updateBlock(
  id: string,
  input: Partial<BlockInput>,
  autorId: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...input,
    atualizadoEm: serverTimestamp(),
  }
  if (input.nome) {
    patch.slug = slugify(input.nome)
  }
  await updateDoc(doc(blocksCollection, id), patch)
  await registrarAuditLog(autorId, 'editar_bloco', id)
}

export async function reorderBlocks(
  ordenados: { id: string; ordem: number }[],
): Promise<void> {
  const batch = writeBatch(db)
  for (const { id, ordem } of ordenados) {
    batch.update(doc(blocksCollection, id), { ordem })
  }
  await batch.commit()
}

export async function deleteBlock(id: string, autorId: string): Promise<void> {
  const [filhos, snapshotArtigos] = await Promise.all([
    listChildren(id),
    getDocs(query(collection(db, 'articles'), where('blockId', '==', id))),
  ])

  if (filhos.length > 0 || !snapshotArtigos.empty) {
    throw new Error(
      'Não é possível excluir um bloco com subblocos ou artigos. Mova ou exclua o conteúdo antes.',
    )
  }

  await deleteDoc(doc(blocksCollection, id))
  await registrarAuditLog(autorId, 'excluir_bloco', id)
}
