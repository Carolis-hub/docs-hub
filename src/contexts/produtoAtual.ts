import { createContext, useContext, useEffect } from 'react'

/** Produto em que a pessoa está navegando (página do produto, subproduto, módulo ou artigo). */
export interface ProdutoAtual {
  id: string
  nome: string
}

interface Valor {
  produto: ProdutoAtual | null
  definir: (produto: ProdutoAtual | null) => void
}

/** Fora do Layout (testes de página, por exemplo) não há produto e `definir` não faz nada. */
export const ProdutoAtualContext = createContext<Valor>({
  produto: null,
  definir: () => undefined,
})

export const useProdutoAtual = () => useContext(ProdutoAtualContext).produto

/**
 * A página avisa em que produto a pessoa está. O cabeçalho usa isso para
 * mostrar a busca (Ctrl+K) só dentro de um produto e procurar só nele.
 */
export function useInformarProdutoAtual(
  produto: { id: string; nome: string } | null | undefined,
): void {
  const { definir } = useContext(ProdutoAtualContext)
  const id = produto?.id
  const nome = produto?.nome
  useEffect(() => {
    if (!id) return
    definir({ id, nome: nome ?? '' })
    return () => definir(null)
  }, [id, nome, definir])
}
