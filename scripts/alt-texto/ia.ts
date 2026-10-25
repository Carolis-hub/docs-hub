import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { ImagemComContexto } from '../../src/utils/altTexto.ts'
import {
  RespostaSchema,
  SISTEMA,
  descreverImagem,
  introducao,
  type Resposta,
} from './prompt.ts'

export interface PedidoAlt {
  tituloArtigo: string
  imagens: ImagemComContexto[]
  /** Quando falso, a IA recebe só o texto (a imagem não pôde ser lida). */
  comImagem: boolean
}

/** Quem escreve os alts. Trocável: os testes usam um provedor falso. */
export interface ProvedorAlt {
  modelo: string
  sugerir(pedido: PedidoAlt): Promise<Resposta>
}

export const MODELO_PADRAO = 'claude-opus-5-5'

export function criarProvedorAnthropic(
  opcoes: { apiKey?: string; modelo?: string } = {},
): ProvedorAlt {
  const modelo = opcoes.modelo ?? process.env.ALT_TEXTO_MODEL ?? MODELO_PADRAO
  // Sem apiKey, o SDK lê ANTHROPIC_API_KEY do ambiente.
  const client = new Anthropic(opcoes.apiKey ? { apiKey: opcoes.apiKey } : {})

  return {
    modelo,
    async sugerir({ tituloArtigo, imagens, comImagem }) {
      const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [
        { type: 'text', text: introducao(tituloArtigo, imagens.length) },
      ]
      for (const img of imagens) {
        conteudo.push({ type: 'text', text: descreverImagem(img) })
        if (comImagem)
          conteudo.push({
            type: 'image',
            source: { type: 'url', url: img.src },
          })
      }
      try {
        const resposta = await client.beta.messages.create({
          model: modelo,
          max_tokens: 4096,
          // Se um classificador de segurança recusar, a API refaz o pedido em outro modelo.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SISTEMA,
          output_config: {
            effort: 'medium',
            format: zodOutputFormat(RespostaSchema),
          },
          messages: [{ role: 'user', content: conteudo }],
        })
        if (resposta.stop_reason === 'refusal') {
          throw new Error(
            `a IA recusou o pedido (${resposta.stop_details?.category ?? 'sem categoria'})`,
          )
        }
        if (resposta.stop_reason === 'max_tokens')
          throw new Error('a resposta da IA foi cortada por tamanho')
        const texto = resposta.content.find((b) => b.type === 'text')
        if (!texto || texto.type !== 'text')
          throw new Error('a IA não devolveu texto')
        return RespostaSchema.parse(JSON.parse(texto.text))
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
