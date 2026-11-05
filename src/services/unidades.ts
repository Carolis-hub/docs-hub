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
import { registrarAuditoria } from './audit'
import { db } from './firebase'
import type { Unidade, UnidadeInput } from '../types/content'
import { slugify } from '../utils/slug'

const unidades = collection(db, 'unidades')

function fromSnap(snap: { id: string; data(): unknown }): Unidade {
  return { id: snap.id, ...(snap.data() as Omit<Unidade, 'id'>) }
}

export async function listUnidades(): Promise<Unidade[]> {
  const snap = await getDocs(unidades)
  return snap.docs
    .map(fromSnap)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
}

export async function getUnidade(id: string): Promise<Unidade | null> {
  const snap = await getDoc(doc(unidades, id))
  return snap.exists() ? fromSnap(snap) : null
}

export async function createUnidade(
  input: UnidadeInput,
  proximaOrdem: number,
  uid: string,
): Promise<Unidade> {
  const ref = doc(unidades)
  const unidade: Omit<Unidade, 'id'> = {
    nome: input.nome.trim(),
    slug: slugify(input.nome),
    descricao: input.descricao.trim(),
    icone: input.icone.trim(),
    ordem: proximaOrdem,
  }
  const batch = writeBatch(db)
  batch.set(ref, unidade)
  registrarAuditoria(batch, uid, 'unidade.criar', `unidades/${ref.id}`)
  await batch.commit()
  return { id: ref.id, ...unidade }
}

export async function updateUnidade(
  id: string,
  input: UnidadeInput,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(unidades, id), {
    nome: input.nome.trim(),
    slug: slugify(input.nome),
    descricao: input.descricao.trim(),
    icone: input.icone.trim(),
  })
  registrarAuditoria(batch, uid, 'unidade.editar', `unidades/${id}`)
  await batch.commit()
}

/** Grava a nova ordem (índice na lista) de todas as unidades de uma vez. */
export async function reorderUnidades(idsEmOrdem: string[]): Promise<void> {
  const batch = writeBatch(db)
  idsEmOrdem.forEach((id, ordem) => batch.update(doc(unidades, id), { ordem }))
  await batch.commit()
}

/** Só exclui unidades sem produtos, para não deixar produtos órfãos. */
export async function deleteUnidade(id: string, uid: string): Promise<void> {
  const produtos = await getDocs(
    query(collection(db, 'blocks'), where('unidadeId', '==', id), limit(1)),
  )
  if (!produtos.empty) {
    throw new Error(
      'Esta unidade ainda tem produtos. Mova-os para outra unidade antes de excluir.',
    )
  }
  const batch = writeBatch(db)
  batch.delete(doc(unidades, id))
  registrarAuditoria(batch, uid, 'unidade.excluir', `unidades/${id}`)
  await batch.commit()
}
