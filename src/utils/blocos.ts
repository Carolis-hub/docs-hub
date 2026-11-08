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
