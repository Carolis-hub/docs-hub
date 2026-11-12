import type { Article, Block } from '../types/content'
import type { SearchItem } from '../types/search'
import { extrairSecoes } from './secoes.ts'

/** Margem de segurança sobre o limite de 1 MiB de um documento do Firestore. */
export const INDEX_LIMITE_BYTES = 800_000
export const TEXTO_INDEX_MAX = 16_000
export const PARTE_RAIZ = 'raiz'

/**
 * O índice de cada produto fica em duas coleções com o mesmo formato: a comum
 * (artigos de público "usuário"), que todo leitor do produto lê, e a técnica,
 * que as regras só liberam a quem tem `verTecnico`. Assim o texto de um artigo
 * técnico nem chega ao navegador de quem não pode vê-lo.
 */
export const COLECAO_INDICE = 'searchIndex'
export const COLECAO_INDICE_TECNICO = 'searchIndexTecnico'
export const COLECOES_INDICE = [COLECAO_INDICE, COLECAO_INDICE_TECNICO] as const
export type ColecaoIndice = (typeof COLECOES_INDICE)[number]

export function colecaoDoPublico(
  publico: SearchItem['publico'],
): ColecaoIndice {
  return publico === 'tecnico' ? COLECAO_INDICE_TECNICO : COLECAO_INDICE
}

/** Separa os itens pela coleção em que cada um deve ficar. */
export function separarPorColecao(
  itens: SearchItem[],
): Record<ColecaoIndice, SearchItem[]> {
  const saida: Record<ColecaoIndice, SearchItem[]> = {
    [COLECAO_INDICE]: [],
    [COLECAO_INDICE_TECNICO]: [],
  }
  for (const item of itens) saida[colecaoDoPublico(item.publico)].push(item)
  return saida
}

/**
 * Junta o que veio das duas coleções. Índices gravados antes da separação
 * ainda podem ter itens técnicos na coleção comum: eles só valem para quem
 * também leu a técnica, e a versão da coleção técnica prevalece.
 */
export function juntarColecoes(
  comuns: SearchItem[],
  tecnicos: SearchItem[] | null,
): SearchItem[] {
  if (tecnicos === null) return comuns.filter((i) => i.publico !== 'tecnico')
  const ids = new Set(tecnicos.map((i) => i.id))
  return [...comuns.filter((i) => !ids.has(i.id)), ...tecnicos]
}

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
  > & {
    id: string
    categoria?: Article['categoria']
    /** Com o conteúdo, o item leva também onde começa cada seção do artigo. */
    conteudo?: Article['conteudo']
  },
): SearchItem {
  const textoPlano = truncarTexto(a.textoPlano)
  const secoes = extrairSecoes(a.conteudo).filter(
    (s) => s.i < textoPlano.length,
  )
  return {
    id: a.id,
    titulo: a.titulo,
    resumo: a.resumo,
    textoPlano,
    blockId: a.blockId,
    publico: a.publico,
    // Só grava quando há categoria: o índice é limitado a ~1 MiB por documento.
    ...(a.categoria ? { categoria: a.categoria } : {}),
    ...(secoes.length > 0 ? { secoes } : {}),
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
