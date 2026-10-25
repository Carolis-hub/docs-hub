import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-suave ">
        Carregando…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Sem acesso</h1>
        <p className="max-w-sm text-suave ">
          Sua conta não está habilitada no docs-hub. Fale com um administrador.
        </p>
        <button type="button" onClick={() => void signOut()} className="botao">
          Sair
        </button>
      </div>
    )
  }

  return <>{children}</>
}
