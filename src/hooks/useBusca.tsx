import { useCallback, useRef, useState } from 'react'
import { useSearchIndex } from './useSearchIndex'
import { registrarBuscaSemResultado } from '../services/searchLogs'
import type { SearchResultItem } from '../types/search'

export interface ResultadoBusca extends SearchResultItem {
  score: number
}

const ATRASO_REGISTRO_MS = 800
const TAMANHO_MINIMO_TERMO = 2

export function useBusca() {
  const {
    garantirIndice,
    carregando: carregandoIndice,
    erro: erroIndice,
  } = useSearchIndex()
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const timeoutRegistroRef = useRef<ReturnType<typeof setTimeout>>()

  const pesquisar = useCallback(
    async (novoTermo: string) => {
      setTermo(novoTermo)
      clearTimeout(timeoutRegistroRef.current)

      const termoLimpo = novoTermo.trim()
      if (termoLimpo.length < TAMANHO_MINIMO_TERMO) {
        setResultados([])
        return
      }

      setBuscando(true)
      try {
        const indice = await garantirIndice()
        const encontrados = indice.search(
          termoLimpo,
        ) as unknown as ResultadoBusca[]
        setResultados(encontrados)

        if (encontrados.length === 0) {
          timeoutRegistroRef.current = setTimeout(() => {
            void registrarBuscaSemResultado(termoLimpo)
          }, ATRASO_REGISTRO_MS)
        }
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    },
    [garantirIndice],
  )

  return {
    termo,
    resultados,
    pesquisar,
    carregando: carregandoIndice || buscando,
    erro: erroIndice,
  }
}
