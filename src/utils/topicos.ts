import type { JSONContent } from '@tiptap/react'

export interface Topico {
  texto: string
  nivel: number
}

function textoDe(no: JSONContent): string {
  if (no.type === 'text') return no.text ?? ''
  return (no.content ?? []).map(textoDe).join('')
}

/** Títulos (H1 a H3) do artigo, na ordem, para o sumário "Neste artigo". */
export function extrairTopicos(doc: JSONContent | undefined): Topico[] {
  const saida: Topico[] = []
  for (const no of doc?.content ?? []) {
    if (no.type !== 'heading') continue
    const texto = textoDe(no).trim()
    if (texto) saida.push({ texto, nivel: Number(no.attrs?.level ?? 2) })
  }
  return saida
}
