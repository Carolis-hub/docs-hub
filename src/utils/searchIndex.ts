import type { Article, Block } from '../types/content'
import type { SearchItem } from '../types/search'

/** Margem de segurança sobre o limite de 1 MiB de um documento do Firestore. */
export const INDEX_LIMITE_BYTES = 800_000
export const TEXTO_INDEX_MAX = 16_000
export const PARTE_RAIZ = 'raiz'

export function tamanhoBytes(valor: unknown): number {
  return new TextEncoder().encode(JSON.stringify(valor)).length
}

export function truncarTexto(texto: string, max = TEXTO_INDEX_MAX): string {
  return texto.length <= max ? texto : texto.slice(0, max)
}

/**
 * Faz uma lista de itens caber no limite de um documento do Firestore. Se
 * passar, encurta o texto de todos os itens (pela metade, até 200 caracteres;
 * depois tira o texto): título e resumo ficam, e a busca perde só o fim dos
 * artigos mais longos. Sem isto, publicar mais um artigo num subproduto muito
 * grande falharia com "documento grande demais". Se nem sem texto couber (são
 * milhares de artigos num só subproduto), devolve como está.
 */
export function caberNoLimite(
  itens: SearchItem[],
  limite = INDEX_LIMITE_BYTES,
): SearchItem[] {
  if (tamanhoBytes({ itens }) <= limite) return itens
  for (
    let max = Math.floor(TEXTO_INDEX_MAX / 2);
    max >= 200;
    max = Math.floor(max / 2)
  ) {
    const menor = itens.map((i) => ({
      ...i,
      textoPlano: truncarTexto(i.textoPlano, max),
    }))
    if (tamanhoBytes({ itens: menor }) <= limite) return menor
  }
  return itens.map((i) => ({ ...i, textoPlano: '' }))
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
  > & { id: string; categoria?: Article['categoria'] },
): SearchItem {
  return {
    id: a.id,
    titulo: a.titulo,
    resumo: a.resumo,
    textoPlano: truncarTexto(a.textoPlano),
    blockId: a.blockId,
    publico: a.publico,
    // Só grava quando há categoria: o índice é limitado a ~1 MiB por documento.
    ...(a.categoria ? { categoria: a.categoria } : {}),
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
    partes: Object.fromEntries(
      Object.entries(
        dividirPorParte(itens, (b) => parteDoBloco(arvore, b)),
      ).map(([parte, lista]) => [parte, caberNoLimite(lista)]),
    ),
  }
}
