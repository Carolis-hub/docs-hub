import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { formatarDataChave, mesesDesde } from '../utils/data'
import type { Article } from '../types/article'
import type { UserRole } from '../types/user'

const articlesCollection = collection(db, 'articles')

function chaveDeduplicacao(uid: string, articleId: string): string {
  return `docs-hub:view:${uid}:${articleId}:${formatarDataChave(new Date())}`
}

/**
 * Registra +1 acesso ao artigo, deduplicado por leitor+artigo+dia no
 * navegador (localStorage) e sem contar admins. Falha silenciosamente:
 * uma métrica perdida não deve atrapalhar a leitura do artigo.
 */
export async function registrarVisualizacao(
  articleId: string,
  uid: string,
  role: UserRole,
): Promise<void> {
  if (role === 'admin') return

  const chave = chaveDeduplicacao(uid, articleId)
  try {
    if (localStorage.getItem(chave)) return
    localStorage.setItem(chave, '1')
  } catch {
    // localStorage indisponível (modo privado etc.): segue sem deduplicar.
  }

  try {
    const articleRef = doc(articlesCollection, articleId)
    const diaRef = doc(
      collection(articleRef, 'viewsDaily'),
      formatarDataChave(new Date()),
    )

    const batch = writeBatch(db)
    batch.update(articleRef, { views: increment(1) })
    batch.set(diaRef, { count: increment(1) }, { merge: true })
    await batch.commit()
  } catch {
    // Métrica é só informativa; não deve quebrar a experiência de leitura.
  }
}

function toArticle(id: string, data: Record<string, unknown>): Article {
  return {
    id,
    blockId: data.blockId as string,
    productId: data.productId as string,
    titulo: data.titulo as string,
    slug: data.slug as string,
    resumo: data.resumo as string,
    conteudo: data.conteudo as Article['conteudo'],
    textoPlano: data.textoPlano as string,
    publico: data.publico as Article['publico'],
    versaoProduto: (data.versaoProduto as string | null) ?? null,
    status: data.status as Article['status'],
    flags: (data.flags as string[]) ?? [],
    views: (data.views as number) ?? 0,
    versao: (data.versao as number) ?? 0,
    autorId: data.autorId as string,
    atualizadoPor: data.atualizadoPor as string,
    criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toMillis() : 0,
    atualizadoEm:
      data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toMillis() : 0,
    revisadoEm:
      data.revisadoEm instanceof Timestamp ? data.revisadoEm.toMillis() : null,
  }
}

/** Uso restrito a admins. */
export async function listArtigosMaisAcessados(
  quantidade = 10,
): Promise<Article[]> {
  const q = query(
    articlesCollection,
    where('status', '==', 'published'),
    orderBy('views', 'desc'),
    limit(quantidade),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toArticle(docSnap.id, docSnap.data()))
}

/** Uso restrito a admins. */
export async function listArtigosSemAcesso(): Promise<Article[]> {
  const q = query(
    articlesCollection,
    where('status', '==', 'published'),
    where('views', '==', 0),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => toArticle(docSnap.id, docSnap.data()))
}

/** Uso restrito a admins: artigos publicados sem revisão há mais de `meses`. */
export async function listArtigosSemRevisao(meses = 6): Promise<Article[]> {
  const q = query(articlesCollection, where('status', '==', 'published'))
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map((docSnap) => toArticle(docSnap.id, docSnap.data()))
    .filter((artigo) => {
      const referencia = artigo.revisadoEm ?? artigo.criadoEm
      return mesesDesde(referencia) > meses
    })
}

export interface ViewsPorDia {
  dia: string
  total: number
}

/** Uso restrito a admins: soma as visualizações diárias de todos os artigos. */
export async function listViewsPorDia(
  diasRecentes = 14,
): Promise<ViewsPorDia[]> {
  const snapshot = await getDocs(collectionGroup(db, 'viewsDaily'))
  const totaisPorDia = new Map<string, number>()

  snapshot.forEach((docSnap) => {
    const dia = docSnap.id
    const count = (docSnap.data().count as number) ?? 0
    totaisPorDia.set(dia, (totaisPorDia.get(dia) ?? 0) + count)
  })

  return [...totaisPorDia.entries()]
    .map(([dia, total]) => ({ dia, total }))
    .sort((a, b) => b.dia.localeCompare(a.dia))
    .slice(0, diasRecentes)
    .reverse()
}

export interface BuscaSemResultado {
  termo: string
  contagem: number
}

/** Uso restrito a admins. */
export async function listBuscasSemResultado(
  quantidade = 20,
): Promise<BuscaSemResultado[]> {
  const q = query(
    collection(db, 'buscasSemResultado'),
    orderBy('contagem', 'desc'),
    limit(quantidade),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({
    termo: docSnap.data().termo as string,
    contagem: (docSnap.data().contagem as number) ?? 0,
  }))
}
