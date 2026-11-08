import { useCallback, useEffect, useState } from 'react'
import { chaveModoAside, modoAsideValido, type ModoAside } from '../utils/aside'

/** Preferência da aside, guardada neste navegador, por usuário. */
export function useModoAside(uid: string | undefined) {
  const ler = useCallback((): ModoAside => {
    if (!uid) return 'toda'
    try {
      return modoAsideValido(localStorage.getItem(chaveModoAside(uid)))
    } catch {
      return 'toda'
    }
  }, [uid])
  const [modo, setModoEstado] = useState<ModoAside>(ler)

  useEffect(() => {
    setModoEstado(ler())
    const aoMudar = () => setModoEstado(ler())
    window.addEventListener('docshub:aside', aoMudar)
    return () => window.removeEventListener('docshub:aside', aoMudar)
  }, [ler])

  const setModo = useCallback(
    (novo: ModoAside) => {
      if (uid) {
        try {
          localStorage.setItem(chaveModoAside(uid), novo)
        } catch {
          /* sem armazenamento: vale só nesta tela */
        }
      }
      setModoEstado(novo)
      window.dispatchEvent(new Event('docshub:aside'))
    },
    [uid],
  )
  return { modo, setModo }
}
