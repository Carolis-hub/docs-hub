import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { podeAcessar, primeiraRotaPermitida } from '../utils/permissoes'

/**
 * Só abre a tela se a pessoa tiver a permissão. Sem ela, vai para a primeira
 * tela que pode usar; se não puder usar nenhuma, vê um aviso (nunca um laço).
 */
export function RequirePermissao({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  const { profile } = useAuth()
  if (podeAcessar(profile, id)) return <>{children}</>
  const destino = primeiraRotaPermitida(profile)
  if (destino) return <Navigate to={destino} replace />
  return (
    <p role="alert" className="text-suave">
      Você não tem acesso a esta funcionalidade. Fale com um administrador.
    </p>
  )
}
