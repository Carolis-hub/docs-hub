import { useState, type FormEvent } from 'react'
import { uploadMidia, MediaUploadError } from '../../services/media'

interface ImageDialogProps {
  onConfirm: (url: string, alt: string) => void
  onClose: () => void
}

export function ImageDialog({ onConfirm, onClose }: ImageDialogProps) {
  const [url, setUrl] = useState('')
  const [alt, setAlt] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)

    if (!alt.trim()) {
      setErro('O texto alternativo é obrigatório.')
      return
    }

    if (arquivo) {
      setEnviando(true)
      try {
        const resultado = await uploadMidia(arquivo)
        onConfirm(resultado.url, alt.trim())
      } catch (error) {
        setErro(
          error instanceof MediaUploadError
            ? error.message
            : 'Não foi possível enviar o arquivo.',
        )
      } finally {
        setEnviando(false)
      }
      return
    }

    if (!url.trim()) {
      setErro('Envie um arquivo ou informe uma URL.')
      return
    }

    onConfirm(url.trim(), alt.trim())
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
        <h2
          id="image-dialog-title"
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Inserir imagem ou GIF
        </h2>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="image-file"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Arquivo (PNG, JPG ou GIF, até 5 MB)
            </label>
            <input
              id="image-file"
              type="file"
              accept="image/png,image/jpeg,image/gif"
              onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
              className="w-full text-sm text-slate-700 dark:text-slate-200"
            />
          </div>
          <div>
            <label
              htmlFor="image-url"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Ou uma URL de imagem já publicada
            </label>
            <input
              id="image-url"
              type="url"
              value={url}
              disabled={!!arquivo}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="image-alt"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Texto alternativo (obrigatório)
            </label>
            <input
              id="image-alt"
              type="text"
              required
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="Descreva a imagem para quem usa leitor de tela"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {erro}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {enviando ? 'Enviando…' : 'Inserir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
