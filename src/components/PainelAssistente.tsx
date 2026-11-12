import { useEffect, useRef } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { AssistenteChat } from './AssistenteChat'

interface Props {
  aberto: boolean
  aoFechar: () => void
}

/**
 * Painel lateral do assistente, disponível em todas as telas. Depois da
 * primeira abertura continua montado (só escondido), para a conversa não se
 * perder ao fechar o painel ou trocar de tela.
 */
/** Quantos artigos tem o produto em contexto (só carrega depois da 1ª abertura). */
function TotalDeArtigos() {
  const total = useSearchEngine().dados?.motor.total
  if (!total) return null
  return (
    <p className="text-xs text-suave">
      Produto atual: {total} {total === 1 ? 'artigo' : 'artigos'}
    </p>
  )
}

export function PainelAssistente({ aberto, aoFechar }: Props) {
  const jaAbriu = useRef(false)
  if (aberto) jaAbriu.current = true

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aberto, aoFechar])

  if (!jaAbriu.current) return null
  return (
    <aside
      role="dialog"
      aria-label="Assistente de documentação"
      aria-hidden={!aberto}
      hidden={!aberto}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-borda bg-cartao shadow-[0_0_40px_rgb(18_53_43_/_0.18)]"
    >
      <header className="flex items-center gap-3 border-b border-borda px-4 py-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#7CC4A3] text-[#0E2A22]">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold leading-tight">
            Assistente de documentação
          </h2>
          <TotalDeArtigos />
        </div>
        <Link
          to="/assistente"
          onClick={aoFechar}
          className="text-xs font-medium text-destaque hover:underline"
        >
          Abrir em tela cheia
        </Link>
        <button
          type="button"
          onClick={aoFechar}
          className="botao-icone"
          aria-label="Fechar o assistente"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <AssistenteChat compacto />
      </div>
    </aside>
  )
}
