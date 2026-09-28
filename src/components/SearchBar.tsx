import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusca } from '../hooks/useBusca'
import { gerarTrecho } from '../utils/trecho'

const LIMITE_RESULTADOS_RAPIDOS = 8

export function SearchBar() {
  const [aberto, setAberto] = useState(false)
  const { termo, resultados, pesquisar, carregando } = useBusca()
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setAberto(true)
      }
      if (event.key === 'Escape') {
        setAberto(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function irParaResultados() {
    setAberto(false)
    navigate(`/busca?q=${encodeURIComponent(termo)}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <span>Buscar…</span>
        <kbd className="rounded border border-slate-300 px-1 text-xs dark:border-slate-600">
          Ctrl K
        </kbd>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Busca"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
          onClick={() => setAberto(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white shadow-lg dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              autoFocus
              type="search"
              value={termo}
              onChange={(event) => void pesquisar(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && termo.trim()) irParaResultados()
              }}
              placeholder="Buscar artigos…"
              className="w-full border-b border-slate-200 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            <div className="max-h-80 overflow-y-auto">
              {carregando && (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  Buscando…
                </p>
              )}

              {!carregando &&
                termo.trim().length >= 2 &&
                resultados.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    Nenhum resultado para “{termo}”.
                  </p>
                )}

              {resultados
                .slice(0, LIMITE_RESULTADOS_RAPIDOS)
                .map((resultado) => {
                  const trecho = gerarTrecho(resultado.textoPlano, [termo])
                  return (
                    <button
                      key={resultado.id}
                      type="button"
                      onClick={() => {
                        setAberto(false)
                        navigate(`/artigos/${resultado.id}`)
                      }}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {resultado.titulo}
                      </p>
                      {trecho && (
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                          {trecho.antes}
                          <mark className="bg-amber-200 dark:bg-amber-700">
                            {trecho.destaque}
                          </mark>
                          {trecho.depois}
                        </p>
                      )}
                    </button>
                  )
                })}
            </div>

            {termo.trim().length >= 2 && (
              <button
                type="button"
                onClick={irParaResultados}
                className="w-full rounded-b-lg bg-slate-50 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Ver todos os resultados →
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
