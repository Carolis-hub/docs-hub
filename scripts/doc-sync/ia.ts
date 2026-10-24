import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  PropostaSchema,
  SISTEMA,
  montarMensagem,
  type Proposta,
} from './prompt.ts'
import type { Regras } from './regras.ts'

export interface EntradaIA {
  tituloArtigo: string
  markdownAtual: string
  regras: Regras
}

/** Quem gera a proposta. Trocável: os testes usam um provedor falso. */
export interface ProvedorIA {
  modelo: string
  propor(entrada: EntradaIA): Promise<Proposta>
}

export const MODELO_PADRAO = 'claude-opus-5-5'

export function criarProvedorAnthropic(
  opcoes: { apiKey?: string; modelo?: string } = {},
): ProvedorIA {
  const modelo = opcoes.modelo ?? process.env.DOC_SYNC_MODEL ?? MODELO_PADRAO
  // Sem apiKey, o SDK lê ANTHROPIC_API_KEY do ambiente.
  const client = new Anthropic(opcoes.apiKey ? { apiKey: opcoes.apiKey } : {})

  return {
    modelo,
    async propor({ tituloArtigo, markdownAtual, regras }) {
      try {
        const resposta = await client.beta.messages.create({
          model: modelo,
          max_tokens: 16000,
          // Se um classificador de segurança recusar, a API refaz o pedido em outro modelo.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SISTEMA,
          output_config: {
            effort: 'medium',
            format: zodOutputFormat(PropostaSchema),
          },
          messages: [
            {
              role: 'user',
              content: montarMensagem(tituloArtigo, markdownAtual, regras),
            },
          ],
        })
        if (resposta.stop_reason === 'refusal') {
          throw new Error(
            `a IA recusou o pedido (${resposta.stop_details?.category ?? 'sem categoria'})`,
          )
        }
        if (resposta.stop_reason === 'max_tokens') {
          throw new Error(
            'a resposta da IA foi cortada por tamanho; o artigo é grande demais para uma passada',
          )
        }
        const texto = resposta.content.find((b) => b.type === 'text')
        if (!texto || texto.type !== 'text')
          throw new Error('a IA não devolveu texto')
        return PropostaSchema.parse(JSON.parse(texto.text))
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) {
          throw new Error(
            'limite de uso da API da Anthropic atingido; tente de novo mais tarde',
          )
        }
        if (e instanceof Anthropic.AuthenticationError) {
          throw new Error(
            'chave da API da Anthropic inválida (ANTHROPIC_API_KEY)',
          )
        }
        throw e
      }
    },
  }
}
