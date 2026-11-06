import type { JSONContent } from '@tiptap/react'
import { extrairTextoPlano } from '../../src/utils/content.ts'

const blocosDe = (doc: JSONContent): string[] =>
  (doc.content ?? [])
    .map((n) =>
      n.type === 'image'
        ? `[imagem] ${String(n.attrs?.src ?? '')}`
        : extrairTextoPlano({ type: 'doc', content: [n] }).trim(),
    )
    .filter(Boolean)

/** Resumo curto do que mudou entre duas versões, comparando os blocos de topo. */
export function resumirMudancas(
  antigo: { titulo: string; conteudo: JSONContent },
  novo: { titulo: string; conteudo: JSONContent },
): string[] {
  const linhas: string[] = []
  if (antigo.titulo.trim() !== novo.titulo.trim()) {
    linhas.push(`Título: "${antigo.titulo}" → "${novo.titulo}"`)
  }
  const a = blocosDe(antigo.conteudo)
  const n = blocosDe(novo.conteudo)
  const contagem = (lista: string[]) => {
    const m = new Map<string, number>()
    lista.forEach((b) => m.set(b, (m.get(b) ?? 0) + 1))
    return m
  }
  const ca = contagem(a)
  const cn = contagem(n)
  let incluidos = 0
  let removidos = 0
  for (const [b, q] of cn) incluidos += Math.max(0, q - (ca.get(b) ?? 0))
  for (const [b, q] of ca) removidos += Math.max(0, q - (cn.get(b) ?? 0))
  if (incluidos)
    linhas.push(`${incluidos} bloco(s) de texto novo(s) ou alterado(s)`)
  if (removidos) linhas.push(`${removidos} bloco(s) removido(s) ou alterado(s)`)
  return linhas.length ? linhas : ['Mudança só de formatação ou de ordem']
}
