import { useCallback, useEffect, useState } from 'react'

/** Carrega dados assíncronos e permite recarregar após uma alteração. */
export function useAsync<T>(carregar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    carregar()
      .then((r) => {
        if (ativo) {
          setDados(r)
          setErro(null)
        }
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { dados, erro, carregando, recarregar }
}
