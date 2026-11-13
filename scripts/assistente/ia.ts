import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { MensagemHistorico } from '../../src/types/assistente.ts'
import type { ConfigAssistente, ProvedorDeIA } from './config.ts'
import type { UsoIA } from './custo.ts'
import {
  EscolhaSchema,
  PlanoSchema,
  RespostaSchema,
  SISTEMA_ESCOLHER,
  SISTEMA_PLANEJAR,
  SISTEMA_RESPONDER,
  mensagemEscolher,
  mensagemPlanejar,
  mensagemResponder,
  type DocumentoParaResposta,
  type RespostaIA,
} from './prompt.ts'

/** Erro da IA com uma mensagem que pode ser mostrada ao usuário. */
export class ErroIA extends Error {}

export interface ProvedorAssistente {
  /** Reformula a pergunta em consultas de busca. */
  planejar(
    pergunta: string,
    historico: MensagemHistorico[],
  ): Promise<{ consultas: string[]; uso: UsoIA }>
  /** Escolhe, entre os candidatos, os artigos que podem responder. */
  escolher(
    pergunta: string,
    candidatos: Array<{ id: string; titulo: string; resumo: string }>,
  ): Promise<{ ids: string[]; uso: UsoIA }>
  /** Escreve a resposta com base nos documentos. */
  responder(
    pergunta: string,
    historico: MensagemHistorico[],
    documentos: DocumentoParaResposta[],
  ): Promise<{ resposta: RespostaIA; uso: UsoIA }>
}

export function criarProvedorAnthropic(opcoes: {
  modelo: string
  modeloBusca: string
  apiKey?: string
}): ProvedorAssistente {
  // Sem apiKey, o SDK lê ANTHROPIC_API_KEY do ambiente.
  const client = new Anthropic(opcoes.apiKey ? { apiKey: opcoes.apiKey } : {})

  async function chamar<S extends z.ZodType>(
    modelo: string,
    sistema: string,
    usuario: string,
    schema: S,
    effort: 'low' | 'medium',
    maxTokens: number,
  ): Promise<{ dados: z.infer<S>; uso: UsoIA }> {
    try {
      const r = await client.beta.messages.create({
        model: modelo,
        max_tokens: maxTokens,
        // Se um classificador de segurança recusar, a API refaz o pedido em outro modelo.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: sistema,
        output_config: { effort, format: zodOutputFormat(schema) },
        messages: [{ role: 'user', content: usuario }],
      })
      if (r.stop_reason === 'refusal') {
        throw new ErroIA('A IA não pôde responder a esta pergunta.')
      }
      if (r.stop_reason === 'max_tokens') {
        throw new ErroIA(
          'A resposta da IA foi cortada por tamanho. Tente uma pergunta mais específica.',
        )
      }
      const texto = r.content.find((b) => b.type === 'text')
      if (!texto || texto.type !== 'text') {
        throw new ErroIA('A IA não devolveu texto.')
      }
      return {
        dados: schema.parse(JSON.parse(texto.text)),
        uso: {
          modelo: r.model ?? modelo,
          entrada: r.usage.input_tokens,
          saida: r.usage.output_tokens,
          cacheLeitura: r.usage.cache_read_input_tokens ?? 0,
          cacheEscrita: r.usage.cache_creation_input_tokens ?? 0,
        },
      }
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) {
        throw new ErroIA(
          'O limite de uso da IA foi atingido. Tente de novo em alguns minutos.',
        )
      }
      if (e instanceof Anthropic.AuthenticationError) {
        throw new ErroIA(
          'A chave da API de IA está inválida. Confira a sua em Minhas preferências ou a do servidor.',
        )
      }
      throw e
    }
  }

  return montarProvedor(chamar, opcoes)
}

type ChamarIA = <S extends z.ZodType>(
  modelo: string,
  sistema: string,
  usuario: string,
  schema: S,
  effort: 'low' | 'medium',
  maxTokens: number,
) => Promise<{ dados: z.infer<S>; uso: UsoIA }>

/** As três etapas do assistente, iguais para qualquer provedor de IA. */
function montarProvedor(
  chamar: ChamarIA,
  opcoes: { modelo: string; modeloBusca: string },
): ProvedorAssistente {
  return {
    async planejar(pergunta, historico) {
      const { dados, uso } = await chamar(
        opcoes.modeloBusca,
        SISTEMA_PLANEJAR,
        mensagemPlanejar(pergunta, historico),
        PlanoSchema,
        'low',
        1000,
      )
      // O limite de 5 é pedido no prompt; aqui só se garante, sem derrubar a resposta.
      const consultas = dados.consultas
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 5)
      return { consultas, uso }
    },
    async escolher(pergunta, candidatos) {
      const { dados, uso } = await chamar(
        opcoes.modeloBusca,
        SISTEMA_ESCOLHER,
        mensagemEscolher(pergunta, candidatos),
        EscolhaSchema,
        'low',
        1000,
      )
      return { ids: dados.ids.slice(0, 8), uso }
    },
    async responder(pergunta, historico, documentos) {
      const { dados, uso } = await chamar(
        opcoes.modelo,
        SISTEMA_RESPONDER,
        mensagemResponder(pergunta, historico, documentos),
        RespostaSchema,
        'medium',
        8000,
      )
      return { resposta: dados, uso }
    },
  }
}

const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions'

interface RespostaGroq {
  model?: string
  choices?: Array<{
    finish_reason?: string
    message?: { content?: string | null }
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * Provedor da Groq (API compatível com a da OpenAI). Roda no plano gratuito,
 * sujeito aos limites por minuto e por dia da conta. Não usa SDK: é um POST.
 * O formato da resposta é pedido no texto (esquema JSON) e conferido com zod.
 */
export function criarProvedorGroq(opcoes: {
  modelo: string
  modeloBusca: string
  apiKey?: string
  /** Só para testes. */
  fetchFn?: typeof fetch
}): ProvedorAssistente {
  const chave = opcoes.apiKey || process.env.GROQ_API_KEY
  const buscar = opcoes.fetchFn ?? fetch

  const chamar: ChamarIA = async (
    modelo,
    sistema,
    usuario,
    schema,
    _effort,
    maxTokens,
  ) => {
    if (!chave) {
      throw new ErroIA('O assistente não tem a chave da Groq configurada.')
    }
    const esquema = JSON.stringify(z.toJSONSchema(schema))
    const instrucao =
      `${sistema}\n\nResponda SOMENTE com um objeto JSON que siga este esquema, ` +
      `sem texto antes ou depois e sem blocos de código:\n${esquema}`

    let r: Response
    try {
      r = await buscar(URL_GROQ, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${chave}`,
        },
        body: JSON.stringify({
          model: modelo,
          max_completion_tokens: maxTokens,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: instrucao },
            { role: 'user', content: usuario },
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      })
    } catch {
      throw new ErroIA(
        'Não foi possível falar com a IA agora. Verifique a conexão e tente de novo.',
      )
    }
    if (r.status === 429) {
      throw new ErroIA(
        'O limite de uso gratuito da IA foi atingido. Tente de novo em alguns minutos.',
      )
    }
    if (r.status === 401 || r.status === 403) {
      throw new ErroIA(
        'A chave da Groq está inválida. Confira GROQ_API_KEY no servidor do assistente.',
      )
    }
    if (!r.ok) {
      throw new ErroIA(`A IA respondeu com erro (HTTP ${r.status}).`)
    }
    const corpo = (await r.json()) as RespostaGroq
    const escolha = corpo.choices?.[0]
    if (escolha?.finish_reason === 'length') {
      throw new ErroIA(
        'A resposta da IA foi cortada por tamanho. Tente uma pergunta mais específica.',
      )
    }
    const texto = escolha?.message?.content
    if (!texto) throw new ErroIA('A IA não devolveu texto.')
    let dados: z.infer<typeof schema>
    try {
      dados = schema.parse(JSON.parse(texto))
    } catch {
      throw new ErroIA(
        'A IA devolveu uma resposta fora do formato esperado. Tente de novo.',
      )
    }
    return {
      dados,
      uso: {
        modelo: corpo.model ?? modelo,
        entrada: corpo.usage?.prompt_tokens ?? 0,
        saida: corpo.usage?.completion_tokens ?? 0,
        cacheLeitura: 0,
        cacheEscrita: 0,
        gratis: true,
      },
    }
  }

  return montarProvedor(chamar, opcoes)
}

/** Cria o provedor escolhido em ASSISTENTE_PROVEDOR. */
export function criarProvedorDaConfig(
  config: Pick<ConfigAssistente, 'provedor' | 'modelo' | 'modeloBusca'>,
  apiKey?: string,
): ProvedorAssistente {
  const base = {
    modelo: config.modelo,
    modeloBusca: config.modeloBusca,
    ...(apiKey ? { apiKey } : {}),
  }
  return config.provedor === 'groq'
    ? criarProvedorGroq(base)
    : criarProvedorAnthropic(base)
}

/** Há chave de IA no ambiente do servidor para o provedor escolhido? */
export function temChaveNoAmbiente(
  provedor: ProvedorDeIA,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(provedor === 'groq' ? env.GROQ_API_KEY : env.ANTHROPIC_API_KEY)
}

/** Provedor usado quando o servidor não tem chave: cada usuário precisa levar a sua. */
export function criarProvedorSemChave(): ProvedorAssistente {
  const falhar = (): never => {
    throw new ErroIA(
      'O assistente não tem chave configurada. Informe a sua em Minhas preferências.',
    )
  }
  return { planejar: falhar, escolher: falhar, responder: falhar }
}
