import { doc, updateDoc } from 'firebase/firestore'
import type {
  AvaliacaoResposta,
  CodigoErroAssistente,
  PedidoAssistente,
  RespostaAssistente,
} from '../types/assistente'
import { lerChaveIA } from '../utils/chaveIA'
import { auth, db } from './firebase'

const URL_ASSISTENTE = import.meta.env.VITE_ASSISTENTE_URL?.trim() || ''

/** `false` enquanto o servidor do assistente não foi configurado. */
export const assistenteConfigurado = () => URL_ASSISTENTE !== ''

export class ErroDoAssistente extends Error {
  readonly codigo: CodigoErroAssistente | 'rede'
  constructor(codigo: CodigoErroAssistente | 'rede', mensagem: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

/**
 * Envia a pergunta ao servidor do assistente. Por padrão a chave da IA fica
 * lá; se o usuário guardou a dele em Preferências, ela vai no cabeçalho
 * `X-Chave-IA`, só para esta chamada.
 */
export async function perguntar(
  pedido: PedidoAssistente,
): Promise<RespostaAssistente> {
  if (!URL_ASSISTENTE) {
    throw new ErroDoAssistente(
      'erro-interno',
      'O assistente ainda não foi configurado neste ambiente.',
    )
  }
  const token = await auth.currentUser?.getIdToken()
  if (!token) {
    throw new ErroDoAssistente(
      'nao-autenticado',
      'Entre no sistema para usar o assistente.',
    )
  }
  // Chave própria do usuário (guardada só neste navegador), se ele informou.
  const chave = lerChaveIA(auth.currentUser?.uid)
  let resposta: Response
  try {
    resposta = await fetch(URL_ASSISTENTE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(chave ? { 'X-Chave-IA': chave } : {}),
      },
      body: JSON.stringify(pedido),
    })
  } catch {
    throw new ErroDoAssistente(
      'rede',
      'Não consegui falar com o assistente. Confira a conexão e se o servidor está no ar.',
    )
  }
  const corpo = (await resposta.json().catch(() => null)) as
    | RespostaAssistente
    | { erro?: { codigo?: CodigoErroAssistente; mensagem?: string } }
    | null
  if (!resposta.ok) {
    const erro = corpo && 'erro' in corpo ? corpo.erro : undefined
    throw new ErroDoAssistente(
      erro?.codigo ?? 'erro-interno',
      erro?.mensagem ?? 'Não foi possível responder agora. Tente de novo.',
    )
  }
  return corpo as RespostaAssistente
}

/** O dono da pergunta marca a resposta como útil ou ruim (as regras só deixam mexer nesse campo). */
export async function avaliarResposta(
  logId: string,
  avaliacao: AvaliacaoResposta,
): Promise<void> {
  await updateDoc(doc(db, 'assistenteLog', logId), { feedback: avaliacao })
}
