import type { ArticlePublico } from './article'

export interface SearchIndexItem {
  id: string
  titulo: string
  resumo: string
  /** Recorte do texto do artigo, só para indexação (ver TEXTO_PLANO_MAX). */
  textoPlano: string
  blockId: string
  publico: ArticlePublico
}

/** Um item do índice já com o produto de origem, usado nos resultados. */
export interface SearchResultItem extends SearchIndexItem {
  productId: string
}
