import imageCompression from 'browser-image-compression'
import { validarArquivoMidia } from '../utils/media'

export interface UploadedMedia {
  url: string
  publicId: string
  width?: number
  height?: number
}

/** PNG é comprimido no navegador; GIF e demais formatos seguem intactos. */
export async function prepararArquivo(file: File): Promise<File> {
  if (file.type !== 'image/png') return file
  try {
    const comprimido = await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 2400,
      useWebWorker: true,
      fileType: 'image/png',
    })
    return comprimido.size < file.size
      ? new File([comprimido], file.name, { type: 'image/png' })
      : file
  } catch {
    return file
  }
}

export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const erro = validarArquivoMidia(file)
  if (erro) throw new Error(erro)

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !preset) {
    throw new Error(
      'Cloudinary não configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET.',
    )
  }

  const pronto = await prepararArquivo(file)
  if (pronto.size > 5 * 1024 * 1024) throw new Error('O arquivo excede 5 MB.')

  const form = new FormData()
  form.append('file', pronto)
  form.append('upload_preset', preset)

  const tipo = pronto.type.startsWith('video/') ? 'video' : 'image'
  const resposta = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${tipo}/upload`,
    { method: 'POST', body: form },
  )
  if (!resposta.ok) {
    throw new Error('Falha no upload para o Cloudinary. Tente novamente.')
  }
  const dados = (await resposta.json()) as {
    secure_url: string
    public_id: string
    width?: number
    height?: number
  }
  return {
    url: dados.secure_url,
    publicId: dados.public_id,
    width: dados.width,
    height: dados.height,
  }
}
