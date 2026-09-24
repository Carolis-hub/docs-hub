import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from './ThemeToggle'

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          docs-hub
        </span>
        <div className="flex items-center gap-3">
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
