import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { linkDoArtigo } from '../utils/linkDoArtigo'

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

  // As sugestões vêm só do produto em contexto (o da tela ou o último usado).
  const produtoAtual = dados?.produtos?.find((p) => p.id === dados.produtoId)
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
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-suave"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        aria-label="Busca rápida"
        placeholder={
          produtoAtual
            ? `Buscar em ${produtoAtual.nome}`
            : 'Buscar artigos por título ou conteúdo'
        }
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
        className="h-10 w-44 rounded-full bg-bloco/60 pl-10 pr-14 text-sm text-texto placeholder:text-suave sm:w-80 lg:w-[420px] [&::-webkit-search-cancel-button]:appearance-none"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-borda bg-bloco px-1.5 py-0.5 font-sans text-[10px] font-medium text-suave sm:block"
      >
        Ctrl K
      </kbd>
      {aberto && sugestoes.length > 0 && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-20 mt-1 w-80 max-w-[90vw] overflow-hidden rounded-lg border border-borda bg-cartao shadow-xl"
        >
          {sugestoes.map(({ item, secao }) => (
            <li key={item.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setAberto(false)
                  navigate(linkDoArtigo(item.id, secao?.titulo))
                }}
                className="block w-full px-3 py-2 text-left text-sm text-texto hover:bg-bloco"
              >
                {item.titulo}
                {secao && (
                  <span className="block text-xs text-suave">
                    {secao.titulo}
                  </span>
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="submit"
              className="block w-full border-t border-borda px-3 py-2 text-left text-xs text-suave hover:bg-bloco"
            >
              Ver todos os resultados
            </button>
          </li>
        </ul>
      )}
    </form>
  )
}
