import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Suggestion } from '../types/content'
import { registrarAuditoria } from './audit'
import { db } from './firebase'

function fromSnap(
  articleId: string,
  snap: { id: string; data(): unknown },
): Suggestion {
  return {
    id: snap.id,
    articleId,
    ...(snap.data() as Omit<Suggestion, 'id' | 'articleId'>),
  }
}

/** Fila de sugestões pendentes de todos os artigos, da mais recente para a mais antiga. */
export async function listPendingSuggestions(): Promise<Suggestion[]> {
  const snap = await getDocs(
    query(collectionGroup(db, 'suggestions'), where('status', '==', 'pending')),
  )
  return snap.docs
    .map((d) => fromSnap(d.ref.parent.parent?.id ?? '', d))
    .sort((a, b) => b.criadoEm - a.criadoEm)
}

export async function getSuggestion(
  articleId: string,
  id: string,
): Promise<Suggestion | null> {
  const snap = await getDoc(doc(db, 'articles', articleId, 'suggestions', id))
  return snap.exists() ? fromSnap(articleId, snap) : null
}

export async function listSuggestionsOfArticle(
  articleId: string,
): Promise<Suggestion[]> {
  const snap = await getDocs(
    collection(db, 'articles', articleId, 'suggestions'),
  )
  return snap.docs
    .map((d) => fromSnap(articleId, d))
    .sort((a, b) => b.criadoEm - a.criadoEm)
}

/** O artigo mudou depois que a IA o leu: a sugestão pode estar defasada. */
export function sugestaoDefasada(
  s: Pick<Suggestion, 'baseVersao' | 'baseAtualizadoEm'>,
  artigo: { versao: number; atualizadoEm: number },
): boolean {
  return (
    artigo.versao !== s.baseVersao || artigo.atualizadoEm > s.baseAtualizadoEm
  )
}

export async function discardSuggestion(
  articleId: string,
  id: string,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'articles', articleId, 'suggestions', id), {
    status: 'discarded',
    decididoPor: uid,
    decididoEm: Date.now(),
  })
  registrarAuditoria(
    batch,
    uid,
    'sugestao.descartar',
    `articles/${articleId}/suggestions/${id}`,
  )
  await batch.commit()
}
