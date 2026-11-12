import type { Block } from '../types/content'

/** O bloco e tudo o que está dentro dele, em qualquer profundidade. */
export function comDescendentes(blocos: Block[], id: string): Set<string> {
  const filhosDe = new Map<string, string[]>()
  for (const b of blocos) {
    if (b.parentId)
      filhosDe.set(b.parentId, [...(filhosDe.get(b.parentId) ?? []), b.id])
  }
  const ids = new Set<string>()
  const pilha = [id]
  while (pilha.length) {
    const atual = pilha.pop() as string
    if (ids.has(atual)) continue
    ids.add(atual)
    pilha.push(...(filhosDe.get(atual) ?? []))
  }
  return ids
}

export const TIPOS_DE_BLOCO = ['Produto', 'Subproduto', 'Módulo'] as const

/** Nome do nível de um bloco pela profundidade (0 = produto); fundo demais vira "Seção". */
export function tipoDoNivel(profundidade: number): string {
  return TIPOS_DE_BLOCO[profundidade] ?? 'Seção'
}

export function tipoDosFilhos(profundidade: number): {
  singular: string
  plural: string
  artigoNovo: string
} {
  const singular = tipoDoNivel(profundidade + 1)
  if (singular === 'Seção') {
    return { singular, plural: 'Seções', artigoNovo: 'Nova seção' }
  }
  return {
    singular,
    plural: singular === 'Módulo' ? 'Módulos' : 'Subprodutos',
    artigoNovo: `Novo ${singular.toLowerCase()}`,
  }
}

/**
 * Ids de todos os irmãos na nova ordem, quando só uma parte deles está na tela
 * (ex.: os produtos de uma unidade). Os itens de `subconjuntoNovo` ocupam, na
 * ordem nova, as mesmas posições que ocupavam na lista completa; os demais
 * não saem do lugar. Assim a ordem gravada nunca bate com a de quem ficou de
 * fora, que era o que embaralhava a lista.
 */
export function ordemCompleta(
  todos: Block[],
  subconjuntoNovo: Block[],
): string[] {
  const ids = [...todos]
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    .map((b) => b.id)
  const noGrupo = new Set(subconjuntoNovo.map((b) => b.id))
  const novos = subconjuntoNovo.map((b) => b.id)
  let i = 0
  return ids.map((id) => (noGrupo.has(id) ? (novos[i++] as string) : id))
}
