import type { ArticlePublico, CategoriaId } from './content'

/** Item de `searchIndex/{productId}`. */
export interface SearchItem {
  id: string
  titulo: string
  resumo: string
  /** Texto sem formatação, truncado para caber no limite do documento. */
  textoPlano: string
  blockId: string
  publico: ArticlePublico
  /** Ausente nos itens indexados antes das categorias existirem. */
  categoria?: CategoriaId | ''
  /** Seções do artigo (títulos H1 a H3). Ausente em artigo sem títulos ou indexado antes delas. */
  secoes?: SecaoIndice[]
}

/** Uma seção no índice: o título (`t`) e onde ela começa em `textoPlano` (`i`). */
export interface SecaoIndice {
  t: string
  i: number
}

/** Item carregado no navegador, com o produto de origem. */
export interface IndexedItem extends SearchItem {
  productId: string
}
