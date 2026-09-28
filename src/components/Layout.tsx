import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { SearchBar } from './SearchBar'
import { ThemeToggle } from './ThemeToggle'

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { profile } = useUserProfile()
  const ehAdmin = profile?.role === 'admin'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            docs-hub
          </span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClasses}>
              Início
            </NavLink>
            {ehAdmin && (
              <>
                <NavLink to="/admin/blocos" className={linkClasses}>
                  Blocos
                </NavLink>
                <NavLink to="/admin/artigos" className={linkClasses}>
                  Artigos
                </NavLink>
                <NavLink to="/admin/usuarios" className={linkClasses}>
                  Usuários
                </NavLink>
                <NavLink to="/admin/metricas" className={linkClasses}>
                  Métricas
                </NavLink>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <SearchBar />
          <ThemeToggle />
          {user && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sair
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  )
}
