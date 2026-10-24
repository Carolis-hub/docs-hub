import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearchEngine } from '../hooks/useSearchEngine'

/** Busca rápida do cabeçalho: atalho Ctrl+K (ou ⌘K) e sugestões. */
export function QuickSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const { dados } = useSearchEngine()

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  const sugestoes = useMemo(
    () => (dados && texto.trim() ? dados.motor.buscar(texto).slice(0, 5) : []),
    [dados, texto],
  )

  function irParaBusca(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setAberto(false)
    navigate(`/busca?q=${encodeURIComponent(texto.trim())}`)
  }

  return (
    <form role="search" onSubmit={irParaBusca} className="relative">
      <input
        ref={inputRef}
        type="search"
        aria-label="Busca rápida"
        placeholder="Buscar… (Ctrl+K)"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setAberto(false)
            inputRef.current?.blur()
          }
        }}
        className="w-48 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm sm:w-64 dark:border-slate-600 dark:bg-slate-900"
      />
      {aberto && sugestoes.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-10 mt-1 w-80 max-w-[90vw] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {sugestoes.map(({ item }) => (
            <li key={item.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAberto(false)
                  navigate(`/a/${item.id}`)
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {item.titulo}
              </button>
            </li>
          ))}
          <li>
            <button
              type="submit"
              className="block w-full border-t border-slate-200 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              Ver todos os resultados
            </button>
          </li>
        </ul>
      )}
    </form>
  )
}
