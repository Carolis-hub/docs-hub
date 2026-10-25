import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icone: LucideIcon
  /** Emoji escolhido pelo admin no cadastro do bloco; substitui o ícone. */
  emoji?: string
  titulo: string
  subtitulo?: string
  acoes?: ReactNode
}

export function PageHeader({
  icone: Icone,
  emoji,
  titulo,
  subtitulo,
  acoes,
}: Props) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-borda pb-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="tile size-12 text-xl" aria-hidden>
          {emoji ? emoji : <Icone className="size-6" />}
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
        </div>
      </div>
      {acoes && (
        <div className="flex flex-wrap items-center gap-2">{acoes}</div>
      )}
    </header>
  )
}
