import { doc, getDoc } from 'firebase/firestore'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { db } from '../services/firebase'
import { useAuth } from './useAuth'
import type { AppUser } from '../types/user'

interface UserProfileContextValue {
  profile: AppUser | null
  loading: boolean
  /** Recarrega o perfil (usado após uma edição feita pelo próprio usuário). */
  reload: () => void
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null)

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: carregandoAuth } = useAuth()
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [versao, setVersao] = useState(0)

  const carregar = useCallback(async () => {
    // Enquanto o Firebase Auth ainda não resolveu a sessão, "user" pode
    // estar temporariamente nulo mesmo para quem está logado. Esperar
    // carregandoAuth terminar evita um falso "sem perfil" nesse intervalo.
    if (carregandoAuth) return

    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid))
      if (!snapshot.exists()) {
        setProfile(null)
      } else {
        const data = snapshot.data()
        setProfile({
          uid: snapshot.id,
          nome: data.nome as string,
          email: data.email as string,
          role: data.role as AppUser['role'],
          produtosPermitidos: (data.produtosPermitidos as string[]) ?? [],
          verTecnico: (data.verTecnico as boolean) ?? false,
          ativo: (data.ativo as boolean) ?? true,
        })
      }
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [user, carregandoAuth])

  useEffect(() => {
    void carregar()
  }, [carregar, versao])

  const value = useMemo(
    () => ({ profile, loading, reload: () => setVersao((v) => v + 1) }),
    [profile, loading],
  )

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  )
}

export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext)
  if (!context) {
    throw new Error(
      'useUserProfile deve ser usado dentro de um UserProfileProvider',
    )
  }
  return context
}
