import { useState, type FormEvent } from 'react'
import type { Block } from '../../types/block'

export interface BlockFormValues {
  nome: string
  descricao: string
  icone: string
}

interface BlockFormProps {
  titulo: string
  blocoInicial?: Block
  onSalvar: (valores: BlockFormValues) => Promise<void>
  onCancelar: () => void
}

export function BlockForm({
  titulo,
  blocoInicial,
  onSalvar,
  onCancelar,
}: BlockFormProps) {
  const [nome, setNome] = useState(blocoInicial?.nome ?? '')
  const [descricao, setDescricao] = useState(blocoInicial?.descricao ?? '')
  const [icone, setIcone] = useState(blocoInicial?.icone ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro(null)

    if (!nome.trim()) {
      setErro('O nome é obrigatório.')
      return
    }

    setSalvando(true)
    try {
      await onSalvar({ nome: nome.trim(), descricao: descricao.trim(), icone })
    } catch {
      setErro('Não foi possível salvar o bloco.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-800">
        <h2
          id="block-form-title"
          className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          {titulo}
        </h2>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="block-nome"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Nome
            </label>
            <input
              id="block-nome"
              type="text"
              required
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="block-descricao"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Descrição
            </label>
            <textarea
              id="block-descricao"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="block-icone"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Ícone (opcional, um emoji ou nome curto)
            </label>
            <input
              id="block-icone"
              type="text"
              value={icone}
              onChange={(event) => setIcone(event.target.value)}
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
              onClick={onCancelar}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
