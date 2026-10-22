import type { EstadoUrl } from './verificar.ts'

/** Sites que recusam robôs respondem assim sem que o link esteja quebrado. */
const BLOQUEIO_DE_ROBO = new Set([401, 403, 429, 999])

async function tentar(url: string): Promise<EstadoUrl> {
  const opcoes = {
    redirect: 'follow' as const,
    signal: AbortSignal.timeout(10_000),
  }
  let resp = await fetch(url, { ...opcoes, method: 'HEAD' })
  // Alguns servidores não aceitam HEAD.
  if ([400, 405, 501].includes(resp.status))
    resp = await fetch(url, { ...opcoes, method: 'GET' })
  if (resp.ok) return { estado: 'ok' }
  if (BLOQUEIO_DE_ROBO.has(resp.status)) {
    return {
      estado: 'inconclusivo',
      motivo: `HTTP ${resp.status} (o site pode bloquear robôs)`,
    }
  }
  if (resp.status === 404 || resp.status === 410) {
    return { estado: 'quebrado', motivo: `HTTP ${resp.status}` }
  }
  // 5xx e afins: pode ser instabilidade momentânea.
  return { estado: 'inconclusivo', motivo: `HTTP ${resp.status}` }
}

/** Confere uma URL externa, com uma segunda tentativa para falhas de rede. */
export async function checarUrl(url: string): Promise<EstadoUrl> {
  for (let i = 0; i < 2; i++) {
    try {
      return await tentar(url)
    } catch (e) {
      if (i === 1) {
        const nome = (e as Error).name
        const cause = (e as { cause?: { code?: string } }).cause?.code
        return {
          // Domínio que não existe mais é o caso clássico de link morto.
          estado: cause === 'ENOTFOUND' ? 'quebrado' : 'inconclusivo',
          motivo:
            cause === 'ENOTFOUND'
              ? 'o domínio não existe'
              : `sem resposta (${nome})`,
        }
      }
    }
  }
  return { estado: 'inconclusivo', motivo: 'sem resposta' }
}
