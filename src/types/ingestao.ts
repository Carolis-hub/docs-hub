/** Situação de cada arquivo numa rodada de ingestão. */
export type EstadoArquivoIngestao =
  | 'novo'
  | 'alterado'
  | 'sem-alteracao'
  | 'reapareceu'
  | 'duplicado'
  | 'removido'
  | 'erro'
  | 'ignorado'
