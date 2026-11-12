import { useSyncExternalStore } from 'react'

/**
 * Produto em que a pessoa está consultando. As telas de produto, de bloco e
 * de artigo o definem ao abrir; a busca e a busca rápida o herdam. Fica
 * guardado no navegador para valer também na próxima visita.
 */
const CHAVE = 'docs-hub:produto-em-contexto'
const ouvintes = new Set<() => void>()

function ler(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? ''
  } catch {
    return ''
  }
}

let atual = ler()

export function definirProdutoEmContexto(produtoId: string): void {
  if (produtoId === atual) return
  atual = produtoId
  try {
    if (produtoId) window.localStorage.setItem(CHAVE, produtoId)
    else window.localStorage.removeItem(CHAVE)
  } catch {
    // Sem armazenamento (modo restrito): o contexto vale só nesta aba.
  }
  ouvintes.forEach((avisar) => avisar())
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar)
  return () => ouvintes.delete(avisar)
}

export function useProdutoEmContexto(): [string, (produtoId: string) => void] {
  const produto = useSyncExternalStore(assinar, () => atual)
  return [produto, definirProdutoEmContexto]
}
