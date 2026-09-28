import MiniSearch from 'minisearch'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { carregarIndices } from '../services/searchIndex'
import { listProducts } from '../services/blocks'
import { normalizarTexto } from '../utils/textoNormalizado'
import { useUserProfile } from './useUserProfile'
import type { SearchResultItem } from '../types/search'

function criarIndice(itens: SearchResultItem[]): MiniSearch<SearchResultItem> {
  const indice = new MiniSearch<SearchResultItem>({
    idField: 'id',
    fields: ['titulo', 'textoPlano'],
    storeFields: [
      'titulo',
      'resumo',
      'textoPlano',
      'blockId',
      'productId',
      'publico',
    ],
    processTerm: (termo) => normalizarTexto(termo),
    searchOptions: {
      boost: { titulo: 3 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
  indice.addAll(itens)
  return indice
}

interface SearchIndexContextValue {
  carregando: boolean
  erro: string | null
  /** Garante que o índice esteja carregado (uma vez por sessão) e o retorna. */
  garantirIndice: () => Promise<MiniSearch<SearchResultItem>>
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null)

export function SearchIndexProvider({ children }: { children: ReactNode }) {
  const { profile } = useUserProfile()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const indiceRef = useRef<MiniSearch<SearchResultItem> | null>(null)
  const promessaRef = useRef<Promise<MiniSearch<SearchResultItem>> | null>(null)

  const garantirIndice = useCallback(async () => {
    if (indiceRef.current) return indiceRef.current
    if (promessaRef.current) return promessaRef.current
    if (!profile) throw new Error('Perfil ainda não carregado.')

    setCarregando(true)
    setErro(null)

    const promessa = (async () => {
      try {
        const productIds =
          profile.role === 'admin'
            ? (await listProducts()).map((produto) => produto.id)
            : profile.produtosPermitidos

        const itens = productIds.length ? await carregarIndices(productIds) : []
        const indice = criarIndice(itens)
        indiceRef.current = indice
        return indice
      } catch (error) {
        setErro('Não foi possível carregar o índice de busca.')
        promessaRef.current = null
        throw error
      } finally {
        setCarregando(false)
      }
    })()

    promessaRef.current = promessa
    return promessa
  }, [profile])

  const value = useMemo(
    () => ({ carregando, erro, garantirIndice }),
    [carregando, erro, garantirIndice],
  )

  return (
    <SearchIndexContext.Provider value={value}>
      {children}
    </SearchIndexContext.Provider>
  )
}

export function useSearchIndex(): SearchIndexContextValue {
  const context = useContext(SearchIndexContext)
  if (!context) {
    throw new Error(
      'useSearchIndex deve ser usado dentro de um SearchIndexProvider',
    )
  }
  return context
}
