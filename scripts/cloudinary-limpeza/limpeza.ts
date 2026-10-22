import { extrairImagens } from '../../src/utils/content.ts'
import type { JSONContent } from '@tiptap/react'

export interface RecursoCloudinary {
  public_id: string
  /** ISO 8601. */
  created_at: string
  bytes?: number
}

/**
 * `public_id` a partir de uma URL de entrega do Cloudinary, ou `null` se a URL
 * não for do Cloudinary. Ignora versão (`v123/`), transformações e extensão.
 */
export function publicIdDaUrl(url: string, cloudName?: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.hostname !== 'res.cloudinary.com') return null
  const partes = decodeURIComponent(u.pathname).split('/').filter(Boolean)
  // /<cloud>/<tipo>/upload/[transformações/][v123/]<public_id>.<ext>
  const [cloud, , entrega, ...resto] = partes
  if (entrega !== 'upload' || !cloud || (cloudName && cloud !== cloudName))
    return null
  while (
    resto.length > 1 &&
    (/^[a-z]{1,3}_[^/]+$/.test(resto[0] ?? '') ||
      (resto[0] ?? '').includes(','))
  ) {
    resto.shift()
  }
  if (/^v\d+$/.test(resto[0] ?? '')) resto.shift()
  const caminho = resto.join('/')
  return caminho ? caminho.replace(/\.[A-Za-z0-9]{2,5}$/, '') : null
}

/** Ids das imagens do Cloudinary usadas em qualquer um dos documentos. */
export function idsReferenciados(
  docs: Iterable<JSONContent>,
  cloudName?: string,
): Set<string> {
  const ids = new Set<string>()
  for (const doc of docs) {
    for (const src of extrairImagens(doc)) {
      const id = publicIdDaUrl(src, cloudName)
      if (id) ids.add(id)
    }
  }
  return ids
}

export interface PlanoLimpeza {
  total: number
  referenciadas: number
  orfas: RecursoCloudinary[]
  /** Órfãs novas demais para apagar (podem ser de um rascunho ainda não salvo). */
  emCarencia: number
  bytesLiberados: number
}

export function planejarLimpeza(
  recursos: RecursoCloudinary[],
  referenciados: Set<string>,
  opcoes: { carenciaDias: number; agora: Date },
): PlanoLimpeza {
  const limite = opcoes.agora.getTime() - opcoes.carenciaDias * 86_400_000
  const orfas: RecursoCloudinary[] = []
  let emCarencia = 0
  for (const r of recursos) {
    if (referenciados.has(r.public_id)) continue
    if (Date.parse(r.created_at) > limite) emCarencia++
    else orfas.push(r)
  }
  return {
    total: recursos.length,
    referenciadas: recursos.length - orfas.length - emCarencia,
    orfas,
    emCarencia,
    bytesLiberados: orfas.reduce((s, r) => s + (r.bytes ?? 0), 0),
  }
}

/**
 * Trava de segurança contra apagar tudo por engano (ex.: falha ao ler o
 * Firestore, que deixaria o conjunto de referenciadas vazio). Devolve o motivo
 * para recusar, ou `null` se pode apagar.
 */
export function motivoParaNaoApagar(
  plano: PlanoLimpeza,
  artigosLidos: number,
): string | null {
  if (plano.orfas.length === 0) return null
  if (artigosLidos === 0) {
    return 'nenhum artigo foi lido do Firestore; apagar agora removeria todas as imagens'
  }
  if (plano.referenciadas === 0) {
    return 'nenhuma imagem do Cloudinary está referenciada por artigos; confira o CLOUDINARY_CLOUD_NAME e a pasta'
  }
  if (plano.orfas.length > plano.total / 2) {
    return `${plano.orfas.length} de ${plano.total} imagens seriam apagadas (mais da metade)`
  }
  return null
}
