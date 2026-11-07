import type { CategoriaId } from './content'

/** Filtros contextuais da pergunta (todos opcionais). */
export interface FiltrosAssistente {
  unidadeId?: string
  produtoId?: string
  subprodutoId?: string
  categoria?: CategoriaId
}

export interface MensagemHistorico {
  papel: 'usuario' | 'assistente'
  texto: string
}

export interface PedidoAssistente {
  pergunta: string
  historico: MensagemHistorico[]
  filtros: FiltrosAssistente
}

/** Documento usado na resposta. `numero` é o que aparece como [n] no texto. */
export interface FonteResposta {
  numero: number
  id: string
  titulo: string
  produto: string
}

export interface RespostaAssistente {
  /** Id do registro em `assistenteLog`, para avaliar a resposta. */
  logId: string
  /** `false` quando a documentação não traz a resposta. */
  encontrou: boolean
  resposta: string
  fontes: FonteResposta[]
  /** Perguntas que ainda cabem na cota de hoje. */
  restantesHoje: number
}

export type CodigoErroAssistente =
  | 'nao-autenticado'
  | 'sem-perfil'
  | 'pergunta-invalida'
  | 'cota-usuario'
  | 'orcamento'
  | 'ia-indisponivel'
  | 'erro-interno'

/** Avaliação dada pelo usuário a uma resposta. */
export type AvaliacaoResposta = 'util' | 'ruim'

/** Registro de uma pergunta (`assistenteLog/{id}`), só admins leem. */
export interface RegistroAssistente {
  id: string
  uid: string
  dia: string
  criadoEm: number
  pergunta: string
  encontrou: boolean
  fontes: string[]
  filtros: FiltrosAssistente
  modelo: string
  tokensEntrada: number
  tokensSaida: number
  custoUsd: number
  ms: number
  feedback: AvaliacaoResposta | null
}

/** Contador diário (`assistenteUso/{id}`): um global e um por usuário. */
export interface UsoDiario {
  id: string
  tipo: 'global' | 'usuario'
  uid?: string
  dia: string
  perguntas: number
  custoUsd: number
  tokensEntrada: number
  tokensSaida: number
}
