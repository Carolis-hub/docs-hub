import type { ArticlePublico } from './content'

/** Item de `searchIndex/{productId}`. */
export interface SearchItem {
  id: string
  titulo: string
  resumo: string
  /** Texto sem formatação, truncado para caber no limite do documento. */
  textoPlano: string
  blockId: string
  publico: ArticlePublico
}

/** Item carregado no navegador, com o produto de origem. */
export interface IndexedItem extends SearchItem {
  productId: string
}
