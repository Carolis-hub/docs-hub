import imageCompression from 'browser-image-compression'

const TIPOS_PERMITIDOS = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'video/webm',
]
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024

export class MediaUploadError extends Error {}

function validarArquivo(arquivo: File): void {
  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new MediaUploadError(
      `Tipo de arquivo não suportado: ${arquivo.type || 'desconhecido'}. Use PNG, JPG, GIF, MP4 ou WEBM.`,
    )
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new MediaUploadError('O arquivo excede o limite de 5 MB.')
  }
}

async function comprimirSeNecessario(arquivo: File): Promise<File> {
  if (arquivo.type !== 'image/png') return arquivo

  try {
    return await imageCompression(arquivo, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/png',
    })
  } catch {
    // Se a compressão falhar, envia o arquivo original em vez de bloquear o upload.
    return arquivo
  }
}

export interface MediaUploadResult {
  url: string
  tipo: string
  largura?: number
  altura?: number
}

export async function uploadMidia(arquivo: File): Promise<MediaUploadResult> {
  validarArquivo(arquivo)

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new MediaUploadError(
      'Cloudinary não está configurado. Preencha VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env.',
    )
  }

  const arquivoFinal = await comprimirSeNecessario(arquivo)

  const formData = new FormData()
  formData.append('file', arquivoFinal)
  formData.append('upload_preset', uploadPreset)

  const resposta = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: 'POST', body: formData },
  )

  if (!resposta.ok) {
    throw new MediaUploadError('Falha ao enviar o arquivo para o Cloudinary.')
  }

  const dados = (await resposta.json()) as {
    secure_url: string
    resource_type: string
    width?: number
    height?: number
  }

  return {
    url: dados.secure_url,
    tipo: dados.resource_type,
    largura: dados.width,
    altura: dados.height,
  }
}
