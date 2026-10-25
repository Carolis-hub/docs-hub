import { useCallback, useState } from 'react'

/** Preferência guardada no navegador (ex.: lista ou grade). Funciona sem o armazenamento. */
export function usePreferencia<T extends string>(
  chave: string,
  padrao: T,
  validos: readonly T[],
): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = window.localStorage.getItem(chave)
      return guardado && (validos as readonly string[]).includes(guardado)
        ? (guardado as T)
        : padrao
    } catch {
      return padrao
    }
  })
  const atualizar = useCallback(
    (novo: T) => {
      setValor(novo)
      try {
        window.localStorage.setItem(chave, novo)
      } catch {
        /* sem armazenamento: a escolha vale só nesta visita */
      }
    },
    [chave],
  )
  return [valor, atualizar]
}
