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

/**
 * Ciclo de vida do artigo. Só `published` aparece para os leitores; os outros
 * cinco ficam restritos a admins (ver `src/utils/ciclo.ts` para as transições).
 */
export type ArticleStatus =
  'draft' | 'review' | 'approved' | 'published' | 'rejected' | 'archived'

/** Estados de uma alteração pendente de um artigo já publicado. */
export type RevisaoStatus = 'draft' | 'review' | 'approved' | 'rejected'

/** Resumo da alteração pendente, guardado no artigo (o conteúdo fica em `revisoes/atual`). */
export interface RevisaoResumo {
  status: RevisaoStatus
  autorId: string
  atualizadoEm: number
}

/**
 * Alteração pendente de um artigo publicado (`articles/{id}/revisoes/atual`).
 * A versão publicada continua no ar até esta ser aprovada e publicada.
 */
export interface Revisao {
  titulo: string
  conteudo: JSONContent
  textoPlano: string
  resumo: string
  publico: ArticlePublico
  categoria?: CategoriaId | ''
  versaoProduto?: string
  status: RevisaoStatus
  /** Versão publicada em que a alteração se baseia. */
  baseVersao: number
  autorId: string
  atualizadoPor: string
  criadoEm: number
  atualizadoEm: number
  aprovadoPor?: string
  aprovadoEm?: number
  /** Sugestão (IA ou ingestão) que originou a alteração; é aprovada ao publicar. */
  sugestaoId?: string
}

export type ComentarioTipo =
  'comentario' | 'ajuste' | 'reprovacao' | 'aprovacao'

/** Comentário de revisão (`articles/{id}/comentarios/{cid}`). */
export interface Comentario {
  id: string
  tipo: ComentarioTipo
  texto: string
  autorId: string
  autorNome: string
  /** Sobre o artigo em si ou sobre a alteração pendente. */
  alvo: 'artigo' | 'revisao'
  criadoEm: number
}
/** De onde veio o artigo; o importado entra na fila de revisão. */
export interface ArticleOrigem {
  tipo: 'editor' | 'importacao'
  /** Ingestão de arquivos: identifica a pasta de origem e o arquivo dentro dela. */
  fonte?: string
  arquivo?: string
  /** SHA-256 do conteúdo do arquivo na última ingestão. */
  hash?: string
  classificacao?: Classificacao
}

/** Sugestão automática (por regras, sem IA) feita na ingestão; o revisor decide. */
export interface Classificacao {
  conteudo: 'funcional' | 'tecnico' | 'misto'
  confianca: 'alta' | 'media' | 'baixa'
  categoria: CategoriaId | ''
  publico: ArticlePublico
  motivos: string[]
}
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
  /** Alteração pendente (só em artigo publicado). */
  revisao?: RevisaoResumo
  aprovadoPor?: string
  aprovadoEm?: number
  origem?: ArticleOrigem
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
  /** Quem aprovou o conteúdo desta versão antes da publicação. */
  aprovadoPor?: string
  aprovadoEm?: number
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
    tipo: 'regras-md' | 'alt-texto' | 'ingestao'
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
