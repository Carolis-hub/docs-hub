import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { MAX_GRUPOS_SINONIMOS } from '../utils/sinonimos'

interface Props {
  sinonimos: string[]
  aoSalvar: (linhas: string[]) => Promise<void>
}

/**
 * Sinônimos da busca do produto (só admin). Um grupo por linha, termos
 * separados por vírgula: quem busca por um acha também os artigos que usam
 * os outros.
 */
export function SinonimosDoProduto({ sinonimos, aoSalvar }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(sinonimos.join('\n'))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await aoSalvar(texto.split('\n'))
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (!editando) {
    return (
      <section aria-label="Sinônimos da busca" className="cartao mb-10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Sinônimos da busca</h2>
            <p className="mt-1 text-sm text-suave">
              {sinonimos.length === 0
                ? 'Nenhum grupo cadastrado. Cadastre as palavras que os usuários usam no lugar das que estão nos artigos.'
                : `${sinonimos.length} ${sinonimos.length === 1 ? 'grupo' : 'grupos'}: quem busca por um termo acha também os artigos que usam os outros.`}
            </p>
          </div>
          <button
            type="button"
            className="botao"
            onClick={() => {
              setTexto(sinonimos.join('\n'))
              setEditando(true)
            }}
          >
            <Pencil className="size-4" aria-hidden />
            Editar sinônimos
          </button>
        </div>
        {sinonimos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {sinonimos.map((linha) => (
              <li key={linha} className="selo">
                {linha}
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <form
      aria-label="Editar os sinônimos da busca"
      className="cartao mb-10 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
    >
      <h2 className="font-semibold">Sinônimos da busca</h2>
      <p className="mt-1 text-sm text-suave">
        Um grupo por linha, com os termos separados por vírgula. Exemplo:{' '}
        <code>excluir, apagar, remover</code>. Até {MAX_GRUPOS_SINONIMOS}{' '}
        grupos; linhas com um termo só são descartadas.
      </p>
      <textarea
        aria-label="Grupos de sinônimos"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        className="campo mt-3 w-full font-mono text-sm"
        placeholder={'excluir, apagar, remover\nfluxo, processo, workflow'}
      />
      {erro && (
        <p role="alert" className="mt-2 text-sm text-perigo">
          {erro}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          type="button"
          className="botao"
          onClick={() => setEditando(false)}
          disabled={salvando}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
