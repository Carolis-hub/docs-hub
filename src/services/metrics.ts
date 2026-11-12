import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Article } from '../types/content'
import {
  chaveVisualizacao,
  diaLocal,
  ultimosDias,
  type DailyView,
} from '../utils/metrics'
import { db } from './firebase'

/**
 * Conta um acesso: soma 1 em `articles/{id}.views` e em
 * `articles/{id}/viewsDaily/{dia}`. Deduplicado no navegador por leitor,
 * artigo e dia. Quem chama não deve registrar acessos de admins.
 * Retorna `true` quando o acesso foi contado.
 */
export async function registrarVisualizacao(
  articleId: string,
  uid: string,
  agora: Date = new Date(),
): Promise<boolean> {
  const dia = diaLocal(agora)
  const chave = chaveVisualizacao(uid, articleId, dia)
  try {
    if (localStorage.getItem(chave)) return false
    localStorage.setItem(chave, '1')
  } catch {
    // Sem localStorage não dá para deduplicar: melhor não contar.
    return false
  }
  try {
    const batch = writeBatch(db)
    batch.update(doc(db, 'articles', articleId), { views: increment(1) })
    batch.set(
      doc(db, 'articles', articleId, 'viewsDaily', dia),
      { count: increment(1), dia },
      { merge: true },
    )
    await batch.commit()
    return true
  } catch {
    // Métrica é opcional; libera uma nova tentativa na próxima visita.
    try {
      localStorage.removeItem(chave)
    } catch {
      /* ignorado */
    }
    return false
  }
}

export interface SearchMiss {
  id: string
  termo: string
  count: number
  ultimaVez: number
  /** Ausente nos registros anteriores à busca por produto. */
  productId?: string
}

/** Votos de "Esta busca ajudou?" de um termo num produto. */
export interface SearchFeedback {
  id: string
  termo: string
  productId: string
  sim: number
  nao: number
  ultimaVez: number
}

export interface MetricsData {
  artigos: Article[]
  views: DailyView[]
  buscasSemResultado: SearchMiss[]
  /** As buscas com mais votos "não ajudou". */
  buscasQueNaoAjudaram: SearchFeedback[]
}

/**
 * Carrega os dados do painel. Custo em leituras: um documento por artigo, um
 * por (artigo × dia com acesso) no período, até 20 buscas sem resultado e
 * até 20 buscas que não ajudaram.
 */
export async function carregarMetricas(
  dias: number,
  hoje: Date = new Date(),
): Promise<MetricsData> {
  const inicio = ultimosDias(dias, hoje)[0] as string
  const [artigosSnap, viewsSnap, missesSnap, retornoSnap] = await Promise.all([
    getDocs(collection(db, 'articles')),
    getDocs(
      query(collectionGroup(db, 'viewsDaily'), where('dia', '>=', inicio)),
    ),
    getDocs(
      query(
        collection(db, 'searchMisses'),
        orderBy('count', 'desc'),
        limit(20),
      ),
    ),
    getDocs(
      query(
        collection(db, 'searchFeedback'),
        where('nao', '>', 0),
        orderBy('nao', 'desc'),
        limit(20),
      ),
    ),
  ])
  return {
    artigos: artigosSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Article,
    ),
    views: viewsSnap.docs.map((d) => ({
      articleId: d.ref.parent.parent?.id ?? '',
      dia: d.data().dia as string,
      count: d.data().count as number,
    })),
    buscasSemResultado: missesSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SearchMiss,
    ),
    buscasQueNaoAjudaram: retornoSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as SearchFeedback,
    ),
  }
}
