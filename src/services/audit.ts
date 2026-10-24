import {
  collection,
  doc,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'

export type AuditAction =
  | 'bloco.criar'
  | 'bloco.editar'
  | 'bloco.excluir'
  | 'artigo.criar'
  | 'artigo.editar'
  | 'artigo.publicar'
  | 'artigo.despublicar'
  | 'artigo.excluir'
  | 'sugestao.aprovar'
  | 'sugestao.descartar'
  | 'artigo.prints'
  | 'usuario.criar'
  | 'usuario.editar'
  | 'usuario.desativar'
  | 'usuario.reativar'

/** Inclui o registro de auditoria no mesmo batch da ação. */
export function registrarAuditoria(
  batch: { set(ref: DocumentReference, data: DocumentData): unknown },
  usuarioId: string,
  acao: AuditAction,
  alvo: string,
): void {
  batch.set(doc(collection(db, 'auditLog')), {
    usuarioId,
    acao,
    alvo,
    data: Date.now(),
  })
}
