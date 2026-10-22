import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validarArquivoMidia } from '../../src/utils/media.ts'

export type Imagem = { bytes: Uint8Array; tipo: string; hash: string }

/** Detecta o tipo pelos primeiros bytes, sem confiar na extensão. */
export function detectarTipo(b: Uint8Array): string | null {
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return 'image/png'
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    b.length >= 4 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38
  ) {
    return 'image/gif'
  }
  return null
}

const FORA_DA_PASTA = 'caminho fora da pasta de exportação'

/** Caminhos locais valem em relação ao artigo e, se não existirem, à raiz do export. */
async function lerArquivoLocal(
  src: string,
  baseDir: string,
  dirDoArtigo: string,
): Promise<Uint8Array> {
  const limpo = decodeURIComponent(src.split(/[?#]/)[0] ?? '')
  const base = path.resolve(baseDir)
  const candidatos = [
    path.resolve(base, dirDoArtigo, limpo),
    path.resolve(base, limpo),
  ]
  let naoEncontrado: unknown
  for (const alvo of candidatos) {
    if (alvo !== base && !alvo.startsWith(base + path.sep)) continue
    try {
      return new Uint8Array(await readFile(alvo))
    } catch (e) {
      naoEncontrado ??= e
    }
  }
  throw naoEncontrado ?? new Error(FORA_DA_PASTA)
}

async function lerBytes(
  src: string,
  baseDir: string,
  dirDoArtigo: string,
): Promise<Uint8Array> {
  if (src.startsWith('data:')) {
    const virgula = src.indexOf(',')
    if (virgula < 0 || !/;base64$/i.test(src.slice(0, virgula))) {
      throw new Error('data URI sem base64')
    }
    return new Uint8Array(Buffer.from(src.slice(virgula + 1), 'base64'))
  }
  if (/^https?:\/\//i.test(src)) {
    const resp = await fetch(src, { signal: AbortSignal.timeout(20_000) })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return new Uint8Array(await resp.arrayBuffer())
  }
  return lerArquivoLocal(src, baseDir, dirDoArtigo)
}

/** Lê a imagem e confere tipo e tamanho (mesmas regras do upload no app). */
export async function carregarImagem(
  src: string,
  baseDir: string,
  dirDoArtigo = '.',
): Promise<Imagem | { erro: string }> {
  let bytes: Uint8Array
  try {
    bytes = await lerBytes(src, baseDir, dirDoArtigo)
  } catch (e) {
    const code = (e as { code?: string }).code
    if ((e as Error).message === FORA_DA_PASTA) return { erro: FORA_DA_PASTA }
    return {
      erro:
        code === 'ENOENT'
          ? 'arquivo não encontrado'
          : `falha ao ler: ${(e as Error).message}`,
    }
  }
  const tipo = detectarTipo(bytes)
  if (!tipo) return { erro: 'não é PNG, JPG ou GIF' }
  const invalido = validarArquivoMidia({ type: tipo, size: bytes.length })
  if (invalido) return { erro: invalido }
  return { bytes, tipo, hash: createHash('sha256').update(bytes).digest('hex') }
}

export interface CloudinaryConfig {
  cloudName: string
  uploadPreset: string
}

export async function enviarCloudinary(
  img: Imagem,
  cfg: CloudinaryConfig,
): Promise<string> {
  const form = new FormData()
  form.append(
    'file',
    new Blob([img.bytes as BlobPart], { type: img.tipo }),
    `${img.hash}`,
  )
  form.append('upload_preset', cfg.uploadPreset)
  const resp = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
    { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) },
  )
  if (!resp.ok) throw new Error(`Cloudinary respondeu HTTP ${resp.status}`)
  const dados = (await resp.json()) as { secure_url?: string }
  if (!dados.secure_url) throw new Error('Cloudinary não devolveu a URL')
  return dados.secure_url
}

export interface ResolvedorOpts {
  baseDir: string
  /** `null` = simulação: valida as imagens, mas não envia nada. */
  cloudinary: CloudinaryConfig | null
  /** hash da imagem → URL já enviada (persistido entre execuções). */
  cache: Map<string, string>
  enviar?: typeof enviarCloudinary
}

export function criarResolvedorImagens(opts: ResolvedorOpts) {
  const enviar = opts.enviar ?? enviarCloudinary
  return async (
    src: string,
    dirDoArtigo = '.',
  ): Promise<{ url: string } | { erro: string }> => {
    const img = await carregarImagem(src, opts.baseDir, dirDoArtigo)
    if ('erro' in img) return img
    const existente = opts.cache.get(img.hash)
    if (existente) return { url: existente }
    if (!opts.cloudinary) return { url: `simulacao://${img.hash.slice(0, 12)}` }
    try {
      const url = await enviar(img, opts.cloudinary)
      opts.cache.set(img.hash, url)
      return { url }
    } catch (e) {
      return { erro: (e as Error).message }
    }
  }
}
