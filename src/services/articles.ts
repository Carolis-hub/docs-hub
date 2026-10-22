import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import { registrarAuditoria } from './audit'
import { db } from './firebase'
import type {
  Article,
  ArticleDraft,
  ArticleStatus,
  ArticleVersion,
} from '../types/content'
import { extrairTextoPlano, gerarResumo, imagensSemAlt } from '../utils/content'
import { slugify } from '../utils/slug'

const articles = collection(db, 'articles')

function fromSnap(snap: { id: string; data(): unknown }): Article {
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
    ...(draft.versaoProduto?.trim()
      ? { versaoProduto: draft.versaoProduto.trim() }
      : {}),
    textoPlano,
    resumo: gerarResumo(textoPlano),
  }
}

function validar(draft: ArticleDraft) {
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

export async function listArticlesByBlock(
  blockId: string,
  apenasPublicados: boolean,
): Promise<Article[]> {
  const constraints = [where('blockId', '==', blockId)]
  if (apenasPublicados) constraints.push(where('status', '==', 'published'))
  const snap = await getDocs(query(articles, ...constraints))
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

/** Salva as edições. Um artigo publicado continua publicado até nova ação. */
export async function saveArticle(
  id: string,
  draft: ArticleDraft,
  uid: string,
): Promise<void> {
  validar(draft)
  const batch = writeBatch(db)
  batch.update(doc(articles, id), {
    ...camposDerivados(draft),
    atualizadoPor: uid,
    atualizadoEm: Date.now(),
  })
  registrarAuditoria(batch, uid, 'artigo.editar', `articles/${id}`)
  await batch.commit()
}

/** Publica e grava o snapshot da versão no mesmo batch. */
export async function publishArticle(
  article: Article,
  draft: ArticleDraft,
  uid: string,
): Promise<number> {
  validar(draft)
  const versao = article.versao + 1
  const agora = Date.now()
  const batch = writeBatch(db)
  batch.update(doc(articles, article.id), {
    ...camposDerivados(draft),
    status: 'published' satisfies ArticleStatus,
    versao,
    atualizadoPor: uid,
    atualizadoEm: agora,
    revisadoEm: agora,
  })
  const snapshot: ArticleVersion = {
    versao,
    titulo: draft.titulo.trim(),
    conteudo: draft.conteudo,
    origem: 'manual',
    autorId: uid,
    criadoEm: agora,
  }
  batch.set(doc(articles, article.id, 'versions', String(versao)), snapshot)
  registrarAuditoria(batch, uid, 'artigo.publicar', `articles/${article.id}`)
  await batch.commit()
  return versao
}

export async function unpublishArticle(id: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(articles, id), {
    status: 'draft' satisfies ArticleStatus,
    atualizadoPor: uid,
    atualizadoEm: Date.now(),
  })
  registrarAuditoria(batch, uid, 'artigo.despublicar', `articles/${id}`)
  await batch.commit()
}

export async function deleteArticle(id: string, uid: string): Promise<void> {
  const versoes = await getDocs(collection(articles, id, 'versions'))
  const batch = writeBatch(db)
  versoes.docs.forEach((v) => batch.delete(v.ref))
  batch.delete(doc(articles, id))
  registrarAuditoria(batch, uid, 'artigo.excluir', `articles/${id}`)
  await batch.commit()
}

export async function listVersions(id: string): Promise<ArticleVersion[]> {
  const snap = await getDocs(
    query(collection(articles, id, 'versions'), orderBy('versao', 'desc')),
  )
  return snap.docs.map((d) => d.data() as ArticleVersion)
}
