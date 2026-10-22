import type { Article, Block } from '../../src/types/content.ts'

/** Formato neutro de exportação lido pelo importador (ver README.md). */
export interface ManifestoBloco {
  id: string
  nome: string
  descricao?: string
  icone?: string
  /** Id do bloco pai; ausente ou `null` para produtos. */
  pai?: string | null
  ordem?: number
}

export interface ManifestoArtigo {
  id: string
  bloco: string
  titulo: string
  /** Caminho do arquivo de conteúdo, relativo à pasta do manifesto. */
  arquivo?: string
  /** Alternativa a `arquivo`: o conteúdo inline. */
  conteudo?: string
  formato?: 'html' | 'markdown'
  publico?: 'usuario' | 'tecnico'
  versaoProduto?: string
  /** Padrão: `true` (o conteúdo já estava no ar na ferramenta antiga). */
  publicado?: boolean
  atualizadoEm?: string
}

export interface Manifesto {
  blocos: ManifestoBloco[]
  artigos: ManifestoArtigo[]
}

export interface Relatorio {
  resumo: {
    blocos: number
    artigos: number
    publicados: number
    rascunhos: number
    imagensOk: number
    imagensComFalha: number
    linksQuebrados: number
    artigosSemBloco: number
  }
  imagensComFalha: Array<{ artigo: string; src: string; motivo: string }>
  linksQuebrados: Array<{ artigo: string; href: string; motivo: string }>
  artigosSemBloco: Array<{ id: string; titulo: string; bloco: string }>
  altsGerados: Array<{ artigo: string; src: string; alt: string }>
  avisos: Array<{ artigo: string; mensagem: string }>
  erros: Array<{ artigo: string; mensagem: string }>
}

export interface Plano {
  blocos: Block[]
  artigos: Article[]
  relatorio: Relatorio
}
