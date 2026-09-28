import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading: carregandoAuth, signOut } = useAuth()
  const { profile, loading: carregandoPerfil } = useUserProfile()

  const semAcesso = !!user && !carregandoPerfil && (!profile || !profile.ativo)

  useEffect(() => {
    if (semAcesso) {
      void signOut()
    }
  }, [semAcesso, signOut])

  if (carregandoAuth || (user && carregandoPerfil)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Carregando…
      </div>
    )
  }

  if (semAcesso) {
    return <Navigate to="/login?motivo=sem-acesso" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
