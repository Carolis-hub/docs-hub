import { useState, type FormEvent } from 'react'
import type { BlockInput } from '../types/content'

interface Props {
  titulo: string
  inicial?: BlockInput
  onSubmit: (input: BlockInput) => Promise<void>
  onCancel: () => void
}

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
      className="cartao mb-6 max-w-lg space-y-3 p-4"
    >
      <h2 className="font-semibold">{titulo}</h2>
      <label className="block text-sm">
        Nome
        <input
          className="campo mt-1"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Descrição
        <textarea
          className="campo mt-1"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Ícone (emoji, opcional)
        <input
          className="campo mt-1"
          value={icone}
          maxLength={4}
          onChange={(e) => setIcone(e.target.value)}
        />
      </label>
      {erro && (
        <p role="alert" className="text-sm text-perigo">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="botao botao-primario"
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" onClick={onCancel} className="botao">
          Cancelar
        </button>
      </div>
    </form>
  )
}
