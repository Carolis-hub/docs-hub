import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { JSONContent } from '@tiptap/core'
import { db } from './firebase'
import { slugify } from '../utils/slug'
import { extrairTextoPlano, gerarResumo } from '../utils/conteudo'
import { registrarAuditLog } from './auditLog'
import type { Article, ArticleInput, ArticleVersion } from '../types/article'

const articlesCollection = collection(db, 'articles')

function toMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toMillis() : 0
}

function toArticle(id: string, data: Record<string, unknown>): Article {
  return {
    id,
    blockId: data.blockId as string,
    productId: data.productId as string,
    titulo: data.titulo as string,
    slug: data.slug as string,
    resumo: data.resumo as string,
    conteudo: data.conteudo as JSONContent,
    textoPlano: data.textoPlano as string,
    publico: data.publico as Article['publico'],
    versaoProduto: (data.versaoProduto as string | null) ?? null,
    status: data.status as Article['status'],
    flags: (data.flags as string[]) ?? [],
    views: (data.views as number) ?? 0,
    versao: (data.versao as number) ?? 0,
    autorId: data.autorId as string,
    atualizadoPor: data.atualizadoPor as string,
    criadoEm: toMillis(data.criadoEm),
    atualizadoEm: toMillis(data.atualizadoEm),
    revisadoEm: data.revisadoEm ? toMillis(data.revisadoEm) : null,
  }
}

export async function getArticle(id: string): Promise<Article | null> {
  const snapshot = await getDoc(doc(articlesCollection, id))
  if (!snapshot.exists()) return null
  return toArticle(snapshot.id, snapshot.data())
}

interface ListArticlesOptions {
  apenasPublicados?: boolean
  /**
   * Necessário quando quem consulta é um leitor: o firestore.rules exige
   * que a consulta filtre por `productId` para provar que só retorna
   * artigos de um produto permitido. Admins chamam sem esse argumento.
   */
  productId?: string
  /** Necessário quando o leitor não tem `verTecnico`. */
  apenasUsuario?: boolean
}

export async function listArticlesByBlock(
  blockId: string,
  {
    apenasPublicados = false,
    productId,
    apenasUsuario = false,
  }: ListArticlesOptions = {},
): Promise<Article[]> {
  const condicoes = [where('blockId', '==', blockId)]
  if (apenasPublicados) {
    condicoes.push(where('status', '==', 'published'))
  }
  if (productId) {
    condicoes.push(where('productId', '==', productId))
  }
  if (apenasUsuario) {
    condicoes.push(where('publico', '==', 'usuario'))
  }
  const q = query(articlesCollection, ...condicoes)
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map((docSnap) => toArticle(docSnap.id, docSnap.data()))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

export async function createArticleDraft(
  input: ArticleInput,
  autorId: string,
): Promise<string> {
  const textoPlano = extrairTextoPlano(input.conteudo)
  const novoDocRef = doc(articlesCollection)

  await runTransaction(db, async (transaction) => {
    transaction.set(novoDocRef, {
      blockId: input.blockId,
      productId: input.productId,
      titulo: input.titulo,
      slug: slugify(input.titulo),
      resumo: gerarResumo(textoPlano),
      conteudo: input.conteudo,
      textoPlano,
      publico: input.publico,
      versaoProduto: input.versaoProduto,
      status: 'draft',
      flags: [],
      views: 0,
      versao: 0,
      autorId,
      atualizadoPor: autorId,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      revisadoEm: null,
    })
  })

  await registrarAuditLog(autorId, 'criar_artigo', novoDocRef.id)
  return novoDocRef.id
}

export async function updateArticleDraft(
  id: string,
  input: Partial<ArticleInput>,
  autorId: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...input,
    atualizadoPor: autorId,
    atualizadoEm: serverTimestamp(),
  }

  if (input.titulo) {
    patch.slug = slugify(input.titulo)
  }

  if (input.conteudo) {
    const textoPlano = extrairTextoPlano(input.conteudo)
    patch.textoPlano = textoPlano
    patch.resumo = gerarResumo(textoPlano)
  }

  await updateDoc(doc(articlesCollection, id), patch)
  await registrarAuditLog(autorId, 'editar_artigo', id)
}

export async function publishArticle(
  id: string,
  autorId: string,
): Promise<void> {
  const articleRef = doc(articlesCollection, id)

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(articleRef)
    if (!snapshot.exists()) {
      throw new Error('Artigo não encontrado')
    }

    const atual = toArticle(snapshot.id, snapshot.data())
    const novaVersao = atual.versao + 1
    const versionRef = doc(
      collection(articleRef, 'versions'),
      String(novaVersao),
    )

    transaction.set(versionRef, {
      versao: novaVersao,
      titulo: atual.titulo,
      resumo: atual.resumo,
      conteudo: atual.conteudo,
      textoPlano: atual.textoPlano,
      origem: 'manual',
      autorId,
      criadoEm: serverTimestamp(),
    })

    transaction.update(articleRef, {
      status: 'published',
      versao: novaVersao,
      atualizadoPor: autorId,
      atualizadoEm: serverTimestamp(),
      revisadoEm: serverTimestamp(),
    })
  })

  await registrarAuditLog(autorId, 'publicar_artigo', id)
}

export async function unpublishArticle(
  id: string,
  autorId: string,
): Promise<void> {
  await updateDoc(doc(articlesCollection, id), {
    status: 'draft',
    atualizadoPor: autorId,
    atualizadoEm: serverTimestamp(),
  })
  await registrarAuditLog(autorId, 'despublicar_artigo', id)
}

export async function listVersions(
  articleId: string,
): Promise<ArticleVersion[]> {
  const versionsCollection = collection(
    doc(articlesCollection, articleId),
    'versions',
  )
  const q = query(versionsCollection, orderBy('versao', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      versao: data.versao as number,
      titulo: data.titulo as string,
      resumo: data.resumo as string,
      conteudo: data.conteudo as JSONContent,
      textoPlano: data.textoPlano as string,
      origem: data.origem as ArticleVersion['origem'],
      autorId: data.autorId as string,
      criadoEm: toMillis(data.criadoEm),
    }
  })
}

export async function restoreVersion(
  articleId: string,
  versao: number,
  autorId: string,
): Promise<void> {
  const versionRef = doc(
    collection(doc(articlesCollection, articleId), 'versions'),
    String(versao),
  )
  const snapshot = await getDoc(versionRef)
  if (!snapshot.exists()) {
    throw new Error('Versão não encontrada')
  }

  const data = snapshot.data()
  await updateDoc(doc(articlesCollection, articleId), {
    titulo: data.titulo,
    resumo: data.resumo,
    conteudo: data.conteudo,
    textoPlano: data.textoPlano,
    slug: slugify(data.titulo as string),
    atualizadoPor: autorId,
    atualizadoEm: serverTimestamp(),
  })
}

export async function deleteArticle(
  id: string,
  autorId: string,
): Promise<void> {
  const articleRef = doc(articlesCollection, id)
  const versionsSnapshot = await getDocs(collection(articleRef, 'versions'))

  const batch = writeBatch(db)
  versionsSnapshot.docs.forEach((versionDoc) => batch.delete(versionDoc.ref))
  batch.delete(articleRef)
  await batch.commit()
  await registrarAuditLog(autorId, 'excluir_artigo', id)
}
