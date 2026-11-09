import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'

export type AuditAction =
  | 'bloco.criar'
  | 'bloco.editar'
  | 'bloco.excluir'
  | 'unidade.criar'
  | 'unidade.editar'
  | 'unidade.excluir'
  | 'artigo.criar'
  | 'artigo.editar'
  | 'artigo.mover'
  | 'artigo.publicar'
  | 'artigo.despublicar'
  | 'artigo.enviar-revisao'
  | 'artigo.devolver-rascunho'
  | 'artigo.aprovar'
  | 'artigo.reprovar'
  | 'artigo.arquivar'
  | 'artigo.restaurar'
  | 'revisao.salvar'
  | 'revisao.descartar'
  | 'comentario.criar'
  | 'artigo.excluir'
  | 'sugestao.aprovar'
  | 'sugestao.descartar'
  | 'artigo.prints'
  | 'artigo.origem-removida'
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
  /** Complemento curto para quem lê a trilha (ex.: "alteração pendente"). */
  detalhe?: string,
): void {
  batch.set(doc(collection(db, 'auditLog')), {
    usuarioId,
    acao,
    alvo,
    data: Date.now(),
    ...(detalhe ? { detalhe } : {}),
  })
}

export interface RegistroAuditoria {
  id: string
  usuarioId: string
  acao: string
  alvo: string
  data: number
  detalhe?: string
}

const fromSnap = (d: { id: string; data(): unknown }): RegistroAuditoria => ({
  id: d.id,
  ...(d.data() as Omit<RegistroAuditoria, 'id'>),
})

/** Trilha mais recente, de todos os alvos (só admin). */
export async function listarAuditoria(
  limite = 200,
): Promise<RegistroAuditoria[]> {
  const snap = await getDocs(
    query(collection(db, 'auditLog'), orderBy('data', 'desc'), limit(limite)),
  )
  return snap.docs.map(fromSnap)
}

/** Histórico de um artigo: quem fez o quê e quando (só admin). */
export async function listarAuditoriaDoArtigo(
  articleId: string,
  limite = 100,
): Promise<RegistroAuditoria[]> {
  const snap = await getDocs(
    query(
      collection(db, 'auditLog'),
      where('alvo', '==', `articles/${articleId}`),
      orderBy('data', 'desc'),
      limit(limite),
    ),
  )
  return snap.docs.map(fromSnap)
}
