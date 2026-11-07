import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  where,
  writeBatch,
} from 'firebase/firestore'
import { registrarAuditoria } from './audit'
import { db } from './firebase'
import { atualizarIndiceTx } from './searchIndex'
import { invalidarCacheBusca } from './search'
import type {
  Article,
  ArticleDraft,
  ArticleOrigem,
  ArticleStatus,
  ArticleVersion,
  RevisaoStatus,
} from '../types/content'
import { extrairTextoPlano, gerarResumo, imagensSemAlt } from '../utils/content'
import { slugify } from '../utils/slug'

const articles = collection(db, 'articles')

export function fromSnap(snap: { id: string; data(): unknown }): Article {
  return { id: snap.id, ...(snap.data() as Omit<Article, 'id'>) }
}

/** Campos derivados do conteúdo, gravados a cada salvamento. */
export function camposDerivados(draft: ArticleDraft) {
  const textoPlano = extrairTextoPlano(draft.conteudo)
  return {
    titulo: draft.titulo.trim(),
    slug: slugify(draft.titulo),
    conteudo: draft.conteudo,
    publico: draft.publico,
    categoria: draft.categoria ?? '',
    ...(draft.versaoProduto?.trim()
      ? { versaoProduto: draft.versaoProduto.trim() }
      : {}),
    textoPlano,
    resumo: gerarResumo(textoPlano),
  }
}

export function validar(draft: ArticleDraft) {
  if (!draft.titulo.trim()) throw new Error('Informe o título do artigo.')
  const faltando = imagensSemAlt(draft.conteudo)
  if (faltando > 0) {
    throw new Error(
      `${faltando} imagem(ns) sem texto alternativo. Preencha antes de salvar.`,
    )
  }
}

export async function getArticle(id: string): Promise<Article | null> {
  const snap = await getDoc(doc(articles, id))
  return snap.exists() ? fromSnap(snap) : null
}

/**
 * Artigos de um bloco. Para um leitor (`leitor` informado) a consulta carrega
 * os filtros que a regra de leitura exige (produto, publicado e, sem
 * permissão técnica, público "usuário"); sem eles o Firestore nega a consulta.
 * Admin passa sem `leitor` e vê também os rascunhos.
 */
export async function listArticlesByBlock(
  blockId: string,
  productId: string,
  leitor?: { verTecnico: boolean },
): Promise<Article[]> {
  const constraints = [
    where('productId', '==', productId),
    where('blockId', '==', blockId),
  ]
  if (leitor) {
    constraints.push(where('status', '==', 'published'))
    if (!leitor.verTecnico) constraints.push(where('publico', '==', 'usuario'))
  }
  const snap = await getDocs(query(articles, ...constraints))
  return snap.docs
    .map(fromSnap)
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
}

/** Artigos de um status, para a fila de revisão (só admin; leitor não passa nas regras). */
export async function listArticlesByStatus(
  status: ArticleStatus,
): Promise<Article[]> {
  const snap = await getDocs(query(articles, where('status', '==', status)))
  return snap.docs.map(fromSnap).sort((a, b) => b.atualizadoEm - a.atualizadoEm)
}

/** Artigos publicados cuja alteração pendente está num estado (ex.: aguardando revisão). */
export async function listArticlesByRevisaoStatus(
  status: RevisaoStatus,
): Promise<Article[]> {
  const snap = await getDocs(
    query(articles, where('revisao.status', '==', status)),
  )
  return snap.docs
    .map(fromSnap)
    .sort(
      (a, b) => (b.revisao?.atualizadoEm ?? 0) - (a.revisao?.atualizadoEm ?? 0),
    )
}

/** Artigos com um alerta (ex.: `origem_removida`), para a fila de revisão. */
export async function listArticlesByFlag(flag: string): Promise<Article[]> {
  const snap = await getDocs(
    query(articles, where('flags', 'array-contains', flag)),
  )
  return snap.docs
    .map(fromSnap)
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
}

export async function createArticle(
  draft: ArticleDraft,
  blockId: string,
  productId: string,
  uid: string,
): Promise<string> {
  validar(draft)
  const ref = doc(articles)
  const agora = Date.now()
  const batch = writeBatch(db)
  batch.set(ref, {
    ...camposDerivados(draft),
    blockId,
    productId,
    status: 'draft' satisfies ArticleStatus,
    origem: { tipo: 'editor' } satisfies ArticleOrigem,
    flags: [],
    views: 0,
    versao: 0,
    autorId: uid,
    atualizadoPor: uid,
    criadoEm: agora,
    atualizadoEm: agora,
    revisadoEm: agora,
  })
  registrarAuditoria(batch, uid, 'artigo.criar', `articles/${ref.id}`)
  await batch.commit()
  return ref.id
}

export async function deleteArticle(id: string, uid: string): Promise<void> {
  const ref = doc(articles, id)
  const [versoes, comentarios] = await Promise.all([
    getDocs(collection(articles, id, 'versions')),
    getDocs(collection(articles, id, 'comentarios')),
  ])
  await runTransaction(db, async (tx) => {
    const atual = fromSnap(await tx.get(ref))
    if (atual.status === 'published') {
      await atualizarIndiceTx(tx, atual.productId, atual.blockId, id, null)
    }
    versoes.docs.forEach((v) => tx.delete(v.ref))
    comentarios.docs.forEach((c) => tx.delete(c.ref))
    tx.delete(doc(articles, id, 'revisoes', 'atual'))
    tx.delete(ref)
    registrarAuditoria(tx, uid, 'artigo.excluir', `articles/${id}`)
  })
  invalidarCacheBusca()
}

export async function listVersions(id: string): Promise<ArticleVersion[]> {
  const snap = await getDocs(
    query(collection(articles, id, 'versions'), orderBy('versao', 'desc')),
  )
  return snap.docs.map((d) => d.data() as ArticleVersion)
}

/** Remove um alerta do artigo (ex.: `prints_desatualizados`, depois de refazer os prints). */
export async function clearFlag(
  id: string,
  flag: string,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(articles, id), { flags: arrayRemove(flag) })
  registrarAuditoria(
    batch,
    uid,
    flag === 'origem_removida' ? 'artigo.origem-removida' : 'artigo.prints',
    `articles/${id}`,
  )
  await batch.commit()
}
