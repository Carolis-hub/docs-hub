import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { iniciais } from '../utils/iniciais'
import { QuickSearch } from './QuickSearch'
import { ThemeToggle } from './ThemeToggle'

const LINKS_ADMIN = [
  { para: '/admin/sugestoes', rotulo: 'Sugestões' },
  { para: '/admin/metricas', rotulo: 'Métricas' },
  { para: '/admin/usuarios', rotulo: 'Usuários' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda bg-fundo">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-texto"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-destaque text-white">
              <BookOpen className="size-4" aria-hidden />
            </span>
            docs-hub
          </Link>

          {isAdmin && (
            <nav aria-label="Administração" className="flex gap-5 text-sm">
              {LINKS_ADMIN.map((l) => (
                <NavLink
                  key={l.para}
                  to={l.para}
                  className={({ isActive }) =>
                    `transition hover:text-texto ${isActive ? 'font-medium text-texto' : 'text-suave'}`
                  }
                >
                  {l.rotulo}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <QuickSearch />
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2 rounded-lg border border-borda bg-cartao py-1 pl-1.5 pr-2">
                <span
                  aria-hidden
                  className="inline-flex size-7 items-center justify-center rounded-full bg-bloco text-[11px] font-semibold text-bloco-icone"
                >
                  {iniciais(profile?.nome, user.email)}
                </span>
                {isAdmin && (
                  <span className="rounded border border-ambar/40 bg-ambar-fundo px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ambar">
                    ADMIN
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded px-1 text-sm font-medium text-texto hover:text-bloco-icone"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  )
}
