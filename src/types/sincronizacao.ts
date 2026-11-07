import type { EstadoArquivoIngestao } from './ingestao'

/** Resumo da última rodada de ingestão de uma fonte (`sincronizacoes/{fonteId}`). */
export interface Sincronizacao {
  fonteId: string
  produtoId: string
  produtoNome: string
  /** Quando a pasta foi conferida pela última vez (ms). */
  ultimaExecucao: number
  /** Quando houve a última rodada com novidade (arquivo novo, alterado ou removido). */
  ultimaMudanca?: number
  modo: 'manual' | 'observar' | 'git'
  repo: string | null
  commit: string | null
  duracaoMs: number
  resumo: Record<EstadoArquivoIngestao, number>
  erros: Array<{ caminho: string; detalhe: string }>
  removidos: string[]
}
