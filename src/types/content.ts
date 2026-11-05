import type { JSONContent } from '@tiptap/react'

export interface Block {
  id: string
  nome: string
  slug: string
  descricao: string
  icone: string
  ordem: number
  /** `null` identifica um produto (raiz). */
  parentId: string | null
  /** Id do produto raiz; no próprio produto é o seu id. */
  productId: string
  /** Unidade de negócio (BU) do produto; só existe nos blocos raiz. */
  unidadeId?: string | null
}

export type BlockInput = Pick<Block, 'nome' | 'descricao' | 'icone'> & {
  /** Só vale para produto: `undefined` mantém o que já está gravado. */
  unidadeId?: string | null
}

/** Unidade de negócio (BU), nível acima dos produtos (`unidades/{id}`). */
export interface Unidade {
  id: string
  nome: string
  slug: string
  descricao: string
  icone: string
  ordem: number
}

export type UnidadeInput = Pick<Unidade, 'nome' | 'descricao' | 'icone'>

/** Classificação funcional do artigo (ver `src/utils/categorias.ts`). */
export type CategoriaId =
  'funcionalidades' | 'configuracoes' | 'processos' | 'regras-de-negocio'

export type ArticleStatus = 'draft' | 'published'
export type ArticlePublico = 'usuario' | 'tecnico'

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
  /** Vazio ou ausente = sem categoria. */
  categoria?: CategoriaId | ''
  versaoProduto?: string
  status: ArticleStatus
  flags: string[]
  views: number
  versao: number
  autorId: string
  atualizadoPor: string
  criadoEm: number
  atualizadoEm: number
  revisadoEm: number
}

export interface ArticleDraft {
  titulo: string
  conteudo: JSONContent
  publico: ArticlePublico
  categoria?: CategoriaId | ''
  versaoProduto?: string
}

export interface ArticleVersion {
  versao: number
  titulo: string
  conteudo: JSONContent
  origem: 'manual' | 'ia'
  autorId: string
  criadoEm: number
}

export type SuggestionStatus = 'pending' | 'approved' | 'discarded'

/** Sugestão de atualização gerada pela IA (`articles/{id}/suggestions/{sid}`). */
export interface Suggestion {
  id: string
  articleId: string
  titulo: string
  conteudo: JSONContent
  textoPlano: string
  resumo: string
  diffResumo: string[]
  motivo: string
  avisos: string[]
  pratsDesatualizados: boolean
  automatico: boolean
  status: SuggestionStatus
  origem: {
    tipo: 'regras-md' | 'alt-texto'
    arquivo: string
    hash: string
    repo?: string
    commit?: string
  }
  /** `versao` e `atualizadoEm` do artigo quando a IA o leu. */
  baseVersao: number
  baseAtualizadoEm: number
  modelo: string
  criadoEm: number
}
