import type { RecursoCloudinary } from './limpeza.ts'

export interface CredenciaisCloudinary {
  cloudName: string
  apiKey: string
  apiSecret: string
}

function cabecalho(c: CredenciaisCloudinary) {
  return {
    Authorization: `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64')}`,
  }
}

const base = (c: CredenciaisCloudinary) =>
  `https://api.cloudinary.com/v1_1/${c.cloudName}`

/** Lista todas as imagens enviadas (opcionalmente só as de uma pasta). */
export async function listarImagens(
  c: CredenciaisCloudinary,
  pasta?: string,
): Promise<RecursoCloudinary[]> {
  const recursos: RecursoCloudinary[] = []
  let cursor: string | undefined
  do {
    const q = new URLSearchParams({ max_results: '500', type: 'upload' })
    if (pasta) q.set('prefix', pasta)
    if (cursor) q.set('next_cursor', cursor)
    const resp = await fetch(`${base(c)}/resources/image?${q}`, {
      headers: cabecalho(c),
      signal: AbortSignal.timeout(30_000),
    })
    if (!resp.ok)
      throw new Error(
        `Cloudinary respondeu HTTP ${resp.status} ao listar imagens`,
      )
    const dados = (await resp.json()) as {
      resources: RecursoCloudinary[]
      next_cursor?: string
    }
    recursos.push(...dados.resources)
    cursor = dados.next_cursor
  } while (cursor)
  return recursos
}

/** Apaga imagens, no máximo 100 por chamada (limite da API). */
export async function apagarImagens(
  c: CredenciaisCloudinary,
  publicIds: string[],
): Promise<number> {
  let apagadas = 0
  for (let i = 0; i < publicIds.length; i += 100) {
    const lote = publicIds.slice(i, i + 100)
    const q = new URLSearchParams()
    lote.forEach((id) => q.append('public_ids[]', id))
    const resp = await fetch(`${base(c)}/resources/image/upload?${q}`, {
      method: 'DELETE',
      headers: cabecalho(c),
      signal: AbortSignal.timeout(60_000),
    })
    if (!resp.ok)
      throw new Error(
        `Cloudinary respondeu HTTP ${resp.status} ao apagar imagens`,
      )
    const dados = (await resp.json()) as { deleted?: Record<string, string> }
    apagadas += Object.values(dados.deleted ?? {}).filter(
      (s) => s === 'deleted',
    ).length
  }
  return apagadas
}
