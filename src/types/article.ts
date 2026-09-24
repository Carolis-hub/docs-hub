import type { JSONContent } from '@tiptap/core'

export type ArticlePublico = 'usuario' | 'tecnico'
export type ArticleStatus = 'draft' | 'published'

export interface Article {
  id: string
  blockId: string
  productId: string
  titulo: string
  slug: string
  resumo: string
  conteudo: JSONContent
  textoPlano: string
  publico: ArticlePublico
  versaoProduto: string | null
  status: ArticleStatus
  flags: string[]
  views: number
  versao: number
  autorId: string
  atualizadoPor: string
  criadoEm: number
  atualizadoEm: number
  revisadoEm: number | null
}

export type ArticleOrigin = 'manual' | 'ia'

export interface ArticleVersion {
  versao: number
  titulo: string
  resumo: string
  conteudo: JSONContent
  textoPlano: string
  origem: ArticleOrigin
  autorId: string
  criadoEm: number
}

export interface ArticleInput {
  blockId: string
  productId: string
  titulo: string
  conteudo: JSONContent
  publico: ArticlePublico
  versaoProduto: string | null
}
