export const MEDIA_MAX_BYTES = 5 * 1024 * 1024

export const MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'video/webm',
] as const

/** Retorna a mensagem de erro, ou `null` quando o arquivo é válido. */
export function validarArquivoMidia(file: {
  type: string
  size: number
}): string | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato não suportado. Use PNG, JPG, GIF, MP4 ou WEBM.'
  }
  if (file.size > MEDIA_MAX_BYTES) {
    return 'O arquivo excede 5 MB.'
  }
  return null
}
