/** Ajustes do assistente. Cada limite pode ser trocado por variável de ambiente. */
export interface ConfigAssistente {
  /** Modelo que escreve a resposta. */
  modelo: string
  /** Modelo que reformula a pergunta e escolhe os artigos (pode ser mais barato). */
  modeloBusca: string
  perguntasPorUsuarioDia: number
  /** Teto de gasto estimado por dia, de todos juntos, em dólares. */
  orcamentoDiarioUsd: number
  /** Artigos lidos pela IA em cada resposta. */
  maxFontes: number
  /** Artigos candidatos levados para a escolha. */
  maxCandidatos: number
  maxCaracteresPorFonte: number
  /** Mensagens anteriores da conversa levadas em conta. */
  maxHistorico: number
}

export const MODELO_PADRAO = 'claude-opus-5-5'

const numero = (v: string | undefined, padrao: number) => {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : padrao
}

export function configDoAmbiente(
  env: Record<string, string | undefined> = process.env,
): ConfigAssistente {
  const modelo = env.ASSISTENTE_MODELO || MODELO_PADRAO
  return {
    modelo,
    modeloBusca: env.ASSISTENTE_MODELO_BUSCA || modelo,
    perguntasPorUsuarioDia: numero(env.ASSISTENTE_PERGUNTAS_POR_DIA, 30),
    orcamentoDiarioUsd: numero(env.ASSISTENTE_ORCAMENTO_DIARIO_USD, 10),
    maxFontes: numero(env.ASSISTENTE_MAX_FONTES, 5),
    maxCandidatos: numero(env.ASSISTENTE_MAX_CANDIDATOS, 12),
    maxCaracteresPorFonte: numero(env.ASSISTENTE_MAX_CARACTERES_FONTE, 6000),
    maxHistorico: 6,
  }
}
