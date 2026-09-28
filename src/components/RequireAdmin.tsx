import type { ReactNode } from 'react'
import { useUserProfile } from '../hooks/useUserProfile'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { profile, loading } = useUserProfile()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Carregando…
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        Acesso restrito a administradores.
      </p>
    )
  }

  return <>{children}</>
}
