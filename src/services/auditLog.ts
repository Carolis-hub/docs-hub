import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export type AuditAction =
  | 'criar_bloco'
  | 'editar_bloco'
  | 'excluir_bloco'
  | 'criar_artigo'
  | 'editar_artigo'
  | 'publicar_artigo'
  | 'despublicar_artigo'
  | 'excluir_artigo'
  | 'criar_usuario'
  | 'editar_usuario'
  | 'desativar_usuario'
  | 'reativar_usuario'

export async function registrarAuditLog(
  usuarioId: string,
  acao: AuditAction,
  alvo: string,
): Promise<void> {
  await addDoc(collection(db, 'auditLog'), {
    usuarioId,
    acao,
    alvo,
    data: serverTimestamp(),
  })
}
