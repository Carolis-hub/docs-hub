import { z } from 'zod'
import type { PedidoAssistente } from '../../src/types/assistente.ts'
import { ErroAssistente, responder, type DepsAssistente } from './responder.ts'

const CATEGORIAS = [
  'funcionalidades',
  'configuracoes',
  'processos',
  'regras-de-negocio',
] as const

const PedidoSchema = z.object({
  pergunta: z.string().trim().min(3).max(1000),
  historico: z
    .array(
      z.object({
        papel: z.enum(['usuario', 'assistente']),
        texto: z.string().max(4000),
      }),
    )
    .max(20)
    .default([]),
  filtros: z
    .object({
      unidadeId: z.string().max(200).optional(),
      produtoId: z.string().max(200).optional(),
      subprodutoId: z.string().max(200).optional(),
      categoria: z.enum(CATEGORIAS).optional(),
    })
    .default({}),
})

export interface Requisicao {
  metodo: string
  authorization?: string
  corpo: unknown
}

export interface Resposta {
  status: number
  corpo: unknown
}

export interface DepsHttp extends DepsAssistente {
  /** Valida o ID token do Firebase e devolve o uid. Lança se for inválido. */
  verificarToken(idToken: string): Promise<string>
}

const erro = (status: number, codigo: string, mensagem: string): Resposta => ({
  status,
  corpo: { erro: { codigo, mensagem } },
})

/**
 * Trata uma chamada ao assistente, sem depender de servidor: o servidor local
 * e a Cloud Function só traduzem a requisição HTTP para esta forma.
 */
export async function tratarRequisicao(
  deps: DepsHttp,
  req: Requisicao,
): Promise<Resposta> {
  if (req.metodo !== 'POST') return erro(405, 'metodo', 'Use POST.')
  const token = /^Bearer (.+)$/i.exec(req.authorization ?? '')?.[1]
  if (!token) {
    return erro(
      401,
      'nao-autenticado',
      'Entre no sistema para usar o assistente.',
    )
  }
  let uid: string
  try {
    uid = await deps.verificarToken(token)
  } catch {
    return erro(401, 'nao-autenticado', 'Sua sessão expirou. Entre de novo.')
  }
  const parsed = PedidoSchema.safeParse(req.corpo)
  if (!parsed.success) {
    return erro(
      400,
      'pergunta-invalida',
      'Escreva uma pergunta com 3 a 1000 caracteres.',
    )
  }
  try {
    const resposta = await responder(deps, uid, parsed.data as PedidoAssistente)
    return { status: 200, corpo: resposta }
  } catch (e) {
    if (e instanceof ErroAssistente) return erro(e.status, e.codigo, e.message)
    // Detalhes só no log do servidor: o usuário não vê mensagens internas.
    console.error('assistente: erro inesperado', e)
    return erro(
      500,
      'erro-interno',
      'Não foi possível responder agora. Tente de novo.',
    )
  }
}
