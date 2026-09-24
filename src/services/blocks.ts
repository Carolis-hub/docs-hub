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
import type { Block, BlockInput } from '../types/block'

const blocksCollection = collection(db, 'blocks')

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

export async function listProducts(): Promise<Block[]> {
  const q = query(
    blocksCollection,
    where('parentId', '==', null),
    orderBy('ordem'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toBlock(docSnap.id, docSnap.data()))
}

export async function listChildren(parentId: string): Promise<Block[]> {
  const q = query(
    blocksCollection,
    where('parentId', '==', parentId),
    orderBy('ordem'),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toBlock(docSnap.id, docSnap.data()))
}

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

export async function createBlock(input: BlockInput): Promise<string> {
  const siblings = input.parentId
    ? await listChildren(input.parentId)
    : await listProducts()
  const ordem = siblings.length

  return runTransaction(db, async (transaction) => {
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
}

export async function updateBlock(
  id: string,
  input: Partial<BlockInput>,
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...input,
    atualizadoEm: serverTimestamp(),
  }
  if (input.nome) {
    patch.slug = slugify(input.nome)
  }
  await updateDoc(doc(blocksCollection, id), patch)
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

export async function deleteBlock(id: string): Promise<void> {
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
}
