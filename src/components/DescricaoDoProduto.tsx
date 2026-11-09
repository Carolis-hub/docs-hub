import { useState } from 'react'
import { Pencil } from 'lucide-react'

interface Props {
  descricao: string
  /** Admin: mostra "Editar" e o convite quando a descrição está vazia. */
  editavel: boolean
  aoSalvar: (descricao: string) => Promise<void>
}

const MAX = 400

/** Breve descrição do produto, em destaque no topo da tela do produto. */
export function DescricaoDoProduto({ descricao, editavel, aoSalvar }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(descricao)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!descricao && !editavel) return null

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await aoSalvar(texto)
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (editando) {
    return (
      <form
        aria-label="Editar a descrição do produto"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
        className="cartao mb-6 space-y-3 p-5"
      >
        <label className="block text-sm font-medium">
          Breve descrição do produto
          <textarea
            className="campo mt-1"
            rows={3}
            maxLength={MAX}
            value={texto}
            autoFocus
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <p className="text-xs text-suave">
          {texto.length}/{MAX} caracteres
        </p>
        {erro && (
          <p role="alert" className="text-sm text-perigo">
            {erro}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            className="botao botao-primario"
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar descrição'}
          </button>
          <button
            type="button"
            className="botao"
            onClick={() => {
              setTexto(descricao)
              setEditando(false)
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <section
      aria-label="Descrição do produto"
      className="mb-6 flex items-start gap-4 rounded-2xl border border-borda bg-gradient-to-br from-bloco/70 to-cartao p-5"
    >
      <p
        className={`flex-1 text-[17px] leading-relaxed ${descricao ? 'text-texto' : 'italic text-suave'}`}
      >
        {descricao ||
          'Este produto ainda não tem uma descrição. Escreva uma breve descrição do que ele faz e para quem é.'}
      </p>
      {editavel && (
        <button
          type="button"
          className="botao shrink-0"
          onClick={() => {
            setTexto(descricao)
            setEditando(true)
          }}
        >
          <Pencil className="size-4" aria-hidden />
          {descricao ? 'Editar descrição' : 'Escrever descrição'}
        </button>
      )}
    </section>
  )
}
