import {
  collection,
  getCountFromServer,
  query,
  where,
} from 'firebase/firestore'
import type { Block, Unidade } from '../types/content'
import { listChildren, listProducts } from './blocks'
import { db } from './firebase'
import { listUnidades } from './unidades'

export interface VisaoGeral {
  produtos: Block[]
  unidades: Unidade[]
  /** Subprodutos de primeiro nível de cada produto (id do produto → blocos). */
  subprodutos: Record<string, Block[]>
  /** Artigos publicados que o usuário pode ver, por produto. */
  artigos: Record<string, number>
}

/**
 * Artigos publicados de um produto. A consulta leva os mesmos filtros que as
 * regras exigem de um leitor (produto, publicado e, sem permissão técnica,
 * público "usuário"), senão o Firestore a nega.
 */
export async function contarArtigosPublicados(
  productId: string,
  verTecnico: boolean,
): Promise<number> {
  const filtros = [
    where('productId', '==', productId),
    where('status', '==', 'published'),
    ...(verTecnico ? [] : [where('publico', '==', 'usuario')]),
  ]
  try {
    const snap = await getCountFromServer(
      query(collection(db, 'articles'), ...filtros),
    )
    return snap.data().count
  } catch {
    return 0
  }
}

/** Dados das telas de navegação: BUs, produtos, subprodutos e contagens. */
export async function carregarVisaoGeral(
  produtosPermitidos: string[] | undefined,
  verTecnico: boolean,
): Promise<VisaoGeral> {
  const [produtos, unidades] = await Promise.all([
    listProducts(produtosPermitidos),
    listUnidades(),
  ])
  const [filhos, contagens] = await Promise.all([
    Promise.all(produtos.map((p) => listChildren(p.id, p.id))),
    Promise.all(produtos.map((p) => contarArtigosPublicados(p.id, verTecnico))),
  ])
  const subprodutos: Record<string, Block[]> = {}
  const artigos: Record<string, number> = {}
  produtos.forEach((p, i) => {
    subprodutos[p.id] = filhos[i] ?? []
    artigos[p.id] = contagens[i] ?? 0
  })
  return { produtos, unidades, subprodutos, artigos }
}

/**
 * Artigos publicados dentro de um conjunto de blocos (um bloco e tudo o que há
 * nele). O Firestore aceita até 30 valores em `in`, então a lista é dividida.
 */
export async function contarArtigosPorBlocos(
  productId: string,
  blockIds: string[],
  verTecnico: boolean,
): Promise<number> {
  let total = 0
  for (let i = 0; i < blockIds.length; i += 30) {
    const parte = blockIds.slice(i, i + 30)
    const filtros = [
      where('productId', '==', productId),
      where('blockId', 'in', parte),
      where('status', '==', 'published'),
      ...(verTecnico ? [] : [where('publico', '==', 'usuario')]),
    ]
    try {
      const snap = await getCountFromServer(
        query(collection(db, 'articles'), ...filtros),
      )
      total += snap.data().count
    } catch {
      // Sem permissão ou sem índice: a contagem é só um resumo, não bloqueia a tela.
    }
  }
  return total
}
