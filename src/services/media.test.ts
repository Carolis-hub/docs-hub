import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaUploadError, uploadMidia } from './media'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(async (file: File) => file),
}))

function criarArquivo(nome: string, tipo: string, tamanho: number): File {
  const conteudo = new Uint8Array(tamanho)
  return new File([conteudo], nome, { type: tipo })
}

describe('uploadMidia', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'docs-hub-teste')
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'preset-teste')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              secure_url:
                'https://res.cloudinary.com/docs-hub-teste/image/upload/v1/teste.png',
              resource_type: 'image',
              width: 800,
              height: 600,
            }),
            { status: 200 },
          ),
      ),
    )
  })

  it('rejeita tipos de arquivo não suportados', async () => {
    const arquivo = criarArquivo(
      'malicioso.exe',
      'application/x-msdownload',
      100,
    )
    await expect(uploadMidia(arquivo)).rejects.toBeInstanceOf(MediaUploadError)
  })

  it('rejeita arquivos acima de 5 MB', async () => {
    const arquivo = criarArquivo('grande.png', 'image/png', 6 * 1024 * 1024)
    await expect(uploadMidia(arquivo)).rejects.toThrow(/5 MB/)
  })

  it('envia o arquivo válido e retorna a URL segura', async () => {
    const arquivo = criarArquivo('captura.png', 'image/png', 1024)
    const resultado = await uploadMidia(arquivo)
    expect(resultado.url).toContain('res.cloudinary.com')
    expect(resultado.largura).toBe(800)
  })
})
