import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore'
import type { Comentario, ComentarioTipo } from '../types/content'
import { registrarAuditoria } from './audit'
import { db } from './firebase'

const colecao = (articleId: string) =>
  collection(db, 'articles', articleId, 'comentarios')

/** Comentários de revisão do artigo, do mais antigo para o mais novo. */
export async function listarComentarios(
  articleId: string,
): Promise<Comentario[]> {
  const snap = await getDocs(query(colecao(articleId), orderBy('criadoEm')))
  return snap.docs.map(
    (d) =>
      ({ id: d.id, ...(d.data() as Omit<Comentario, 'id'>) }) as Comentario,
  )
}

export async function adicionarComentario(
  articleId: string,
  entrada: {
    texto: string
    tipo?: ComentarioTipo
    alvo: Comentario['alvo']
  },
  uid: string,
  autorNome: string,
): Promise<void> {
  const texto = entrada.texto.trim()
  if (!texto) throw new Error('Escreva o comentário.')
  const batch = writeBatch(db)
  batch.set(doc(colecao(articleId)), {
    tipo: entrada.tipo ?? 'comentario',
    texto,
    autorId: uid,
    autorNome,
    alvo: entrada.alvo,
    criadoEm: Date.now(),
  })
  registrarAuditoria(batch, uid, 'comentario.criar', `articles/${articleId}`)
  await batch.commit()
}
