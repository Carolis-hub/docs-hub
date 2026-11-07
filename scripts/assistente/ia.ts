import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import type { MensagemHistorico } from '../../src/types/assistente.ts'
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
          'A chave da API da Anthropic está inválida no servidor do assistente.',
        )
      }
      throw e
    }
  }

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
