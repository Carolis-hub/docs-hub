/** Confere se um link externo responde. Devolve o motivo da falha, ou `null`. */
export function criarVerificadorDeLinks() {
  const cache = new Map<string, Promise<string | null>>()
  const checar = async (href: string): Promise<string | null> => {
    try {
      let resp = await fetch(href, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(8_000),
      })
      if (resp.status === 405 || resp.status === 501) {
        resp = await fetch(href, {
          redirect: 'follow',
          signal: AbortSignal.timeout(8_000),
        })
      }
      return resp.ok ? null : `HTTP ${resp.status}`
    } catch (e) {
      return `sem resposta (${(e as Error).name})`
    }
  }
  return (href: string) => {
    let r = cache.get(href)
    if (!r) {
      r = checar(href)
      cache.set(href, r)
    }
    return r
  }
}
