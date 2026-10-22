import {
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
import { atualizarIndiceTx, itemDoArtigo } from './searchIndex'
import { invalidarCacheBusca } from './search'
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

/**
 * Salva as edições. Um artigo publicado continua publicado, então o índice de
 * busca acompanha a edição na mesma transação.
 */
export async function saveArticle(
  id: string,
  draft: ArticleDraft,
  uid: string,
): Promise<void> {
  validar(draft)
  const ref = doc(articles, id)
  await runTransaction(db, async (tx) => {
    const atual = fromSnap(await tx.get(ref))
    const campos = camposDerivados(draft)
    if (atual.status === 'published') {
      await atualizarIndiceTx(
        tx,
        atual.productId,
        atual.blockId,
        id,
        itemDoArtigo({ ...campos, id, blockId: atual.blockId }),
      )
    }
    tx.update(ref, { ...campos, atualizadoPor: uid, atualizadoEm: Date.now() })
    registrarAuditoria(tx, uid, 'artigo.editar', `articles/${id}`)
  })
  invalidarCacheBusca()
}

/** Publica, grava o snapshot da versão e atualiza o índice de busca. */
export async function publishArticle(
  article: Article,
  draft: ArticleDraft,
  uid: string,
): Promise<number> {
  validar(draft)
  const versao = article.versao + 1
  const agora = Date.now()
  const campos = camposDerivados(draft)
  await runTransaction(db, async (tx) => {
    await atualizarIndiceTx(
      tx,
      article.productId,
      article.blockId,
      article.id,
      itemDoArtigo({ ...campos, id: article.id, blockId: article.blockId }),
    )
    tx.update(doc(articles, article.id), {
      ...campos,
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
    tx.set(doc(articles, article.id, 'versions', String(versao)), snapshot)
    registrarAuditoria(tx, uid, 'artigo.publicar', `articles/${article.id}`)
  })
  invalidarCacheBusca()
  return versao
}

export async function unpublishArticle(id: string, uid: string): Promise<void> {
  const ref = doc(articles, id)
  await runTransaction(db, async (tx) => {
    const atual = fromSnap(await tx.get(ref))
    await atualizarIndiceTx(tx, atual.productId, atual.blockId, id, null)
    tx.update(ref, {
      status: 'draft' satisfies ArticleStatus,
      atualizadoPor: uid,
      atualizadoEm: Date.now(),
    })
    registrarAuditoria(tx, uid, 'artigo.despublicar', `articles/${id}`)
  })
  invalidarCacheBusca()
}

export async function deleteArticle(id: string, uid: string): Promise<void> {
  const ref = doc(articles, id)
  const versoes = await getDocs(collection(articles, id, 'versions'))
  await runTransaction(db, async (tx) => {
    const atual = fromSnap(await tx.get(ref))
    if (atual.status === 'published') {
      await atualizarIndiceTx(tx, atual.productId, atual.blockId, id, null)
    }
    versoes.docs.forEach((v) => tx.delete(v.ref))
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
