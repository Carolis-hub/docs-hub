import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Block, BlockInput } from '../types/content'
import { slugify } from '../utils/slug'

const blocks = collection(db, 'blocks')

function ordenar(lista: Block[]): Block[] {
  return [...lista].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
  )
}

function fromSnap(snap: { id: string; data(): unknown }): Block {
  return { id: snap.id, ...(snap.data() as Omit<Block, 'id'>) }
}

export async function getBlock(id: string): Promise<Block | null> {
  const snap = await getDoc(doc(blocks, id))
  return snap.exists() ? fromSnap(snap) : null
}

/** Produtos (blocos raiz). O leitor só recebe os permitidos pelas regras. */
export async function listProducts(
  produtosPermitidos?: string[],
): Promise<Block[]> {
  if (produtosPermitidos) {
    if (produtosPermitidos.length === 0) return []
    const snaps = await Promise.all(
      produtosPermitidos.map((id) => getDoc(doc(blocks, id))),
    )
    return ordenar(snaps.filter((s) => s.exists()).map(fromSnap))
  }
  const snap = await getDocs(query(blocks, where('parentId', '==', null)))
  return ordenar(snap.docs.map(fromSnap))
}

export async function listChildren(parentId: string): Promise<Block[]> {
  const snap = await getDocs(query(blocks, where('parentId', '==', parentId)))
  return ordenar(snap.docs.map(fromSnap))
}

/** Todos os blocos de um produto (inclui o próprio produto). */
export async function listProductTree(productId: string): Promise<Block[]> {
  const snap = await getDocs(query(blocks, where('productId', '==', productId)))
  return ordenar(snap.docs.map(fromSnap))
}

/** Cadeia do produto até o bloco, para o breadcrumb. */
export async function getAncestors(block: Block): Promise<Block[]> {
  const cadeia: Block[] = [block]
  let atual = block
  while (atual.parentId) {
    const pai = await getBlock(atual.parentId)
    if (!pai) break
    cadeia.unshift(pai)
    atual = pai
  }
  return cadeia
}

export async function createBlock(
  input: BlockInput,
  parent: Block | null,
  proximaOrdem: number,
): Promise<Block> {
  const ref = doc(blocks)
  const block: Omit<Block, 'id'> = {
    nome: input.nome.trim(),
    slug: slugify(input.nome),
    descricao: input.descricao.trim(),
    icone: input.icone.trim(),
    ordem: proximaOrdem,
    parentId: parent ? parent.id : null,
    productId: parent ? parent.productId : ref.id,
  }
  const batch = writeBatch(db)
  batch.set(ref, block)
  await batch.commit()
  return { id: ref.id, ...block }
}

export async function updateBlock(
  id: string,
  input: BlockInput,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(blocks, id), {
    nome: input.nome.trim(),
    slug: slugify(input.nome),
    descricao: input.descricao.trim(),
    icone: input.icone.trim(),
  })
  await batch.commit()
}

/** Grava a nova ordem (índice na lista) de todos os irmãos de uma vez. */
export async function reorderBlocks(idsEmOrdem: string[]): Promise<void> {
  const batch = writeBatch(db)
  idsEmOrdem.forEach((id, ordem) => batch.update(doc(blocks, id), { ordem }))
  await batch.commit()
}

/** Só exclui blocos vazios, para não deixar artigos ou blocos órfãos. */
export async function deleteBlock(id: string): Promise<void> {
  const [filhos, artigos] = await Promise.all([
    getDocs(query(blocks, where('parentId', '==', id), limit(1))),
    getDocs(
      query(collection(db, 'articles'), where('blockId', '==', id), limit(1)),
    ),
  ])
  if (!filhos.empty || !artigos.empty) {
    throw new Error(
      'Este bloco não está vazio. Mova ou exclua os subblocos e artigos antes.',
    )
  }
  const batch = writeBatch(db)
  batch.delete(doc(blocks, id))
  await batch.commit()
}
