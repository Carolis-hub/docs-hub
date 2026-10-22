import { useState, type FormEvent } from 'react'
import type { BlockInput } from '../types/content'

interface Props {
  titulo: string
  inicial?: BlockInput
  onSubmit: (input: BlockInput) => Promise<void>
  onCancel: () => void
}

const campo =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'

export function BlockForm({ titulo, inicial, onSubmit, onCancel }: Props) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [icone, setIcone] = useState(inicial?.icone ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await onSubmit({ nome, descricao, icone })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label={titulo}
      className="mb-6 max-w-lg space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 className="font-semibold">{titulo}</h2>
      <label className="block text-sm">
        Nome
        <input
          className={campo}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Descrição
        <textarea
          className={campo}
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Ícone (emoji)
        <input
          className={campo}
          value={icone}
          maxLength={4}
          onChange={(e) => setIcone(e.target.value)}
        />
      </label>
      {erro && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
