import type { Article, Block } from '../types/content'
import type { SearchItem } from '../types/search'

/** Margem de segurança sobre o limite de 1 MiB de um documento do Firestore. */
export const INDEX_LIMITE_BYTES = 800_000
export const TEXTO_INDEX_MAX = 4000
export const PARTE_RAIZ = 'raiz'

export function tamanhoBytes(valor: unknown): number {
  return new TextEncoder().encode(JSON.stringify(valor)).length
}

export function truncarTexto(texto: string, max = TEXTO_INDEX_MAX): string {
  return texto.length <= max ? texto : texto.slice(0, max)
}

/** Insere, substitui (mesmo id) ou remove (`item === null`) um item. */
export function aplicarItem(
  itens: SearchItem[],
  id: string,
  item: SearchItem | null,
): SearchItem[] {
  const resto = itens.filter((i) => i.id !== id)
  return item ? [...resto, item] : resto
}

/**
 * Subproduto (filho direto do produto) ao qual o bloco pertence.
 * Blocos soltos no próprio produto vão para `PARTE_RAIZ`.
 */
export function parteDoBloco(blocos: Block[], blockId: string): string {
  const porId = new Map(blocos.map((b) => [b.id, b]))
  let atual = porId.get(blockId)
  if (!atual || atual.parentId === null) return PARTE_RAIZ
  while (atual.parentId !== null) {
    const pai = porId.get(atual.parentId)
    if (!pai || pai.parentId === null) return atual.id
    atual = pai
  }
  return PARTE_RAIZ
}

export function dividirPorParte(
  itens: SearchItem[],
  parteDe: (blockId: string) => string,
): Record<string, SearchItem[]> {
  const partes: Record<string, SearchItem[]> = {}
  for (const item of itens) {
    const chave = parteDe(item.blockId)
    ;(partes[chave] ??= []).push(item)
  }
  return partes
}

export function itemDoArtigo(
  a: Pick<
    Article,
    'titulo' | 'resumo' | 'textoPlano' | 'blockId' | 'publico'
  > & { id: string },
): SearchItem {
  return {
    id: a.id,
    titulo: a.titulo,
    resumo: a.resumo,
    textoPlano: truncarTexto(a.textoPlano),
    blockId: a.blockId,
    publico: a.publico,
  }
}

export interface IndiceMontado {
  principal: { itens: SearchItem[]; dividido?: true }
  /** Só preenchido quando o índice foi dividido por subproduto. */
  partes: Record<string, SearchItem[]>
}

/** Monta o índice completo de um produto, dividindo-o se passar do limite. */
export function montarIndice(
  itens: SearchItem[],
  arvore: Block[],
): IndiceMontado {
  if (tamanhoBytes({ itens }) <= INDEX_LIMITE_BYTES) {
    return { principal: { itens }, partes: {} }
  }
  return {
    principal: { itens: [], dividido: true },
    partes: dividirPorParte(itens, (b) => parteDoBloco(arvore, b)),
  }
}
