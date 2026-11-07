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
