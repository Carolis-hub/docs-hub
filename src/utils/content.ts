import type { JSONContent } from '@tiptap/react'

export const RESUMO_MAX = 200

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [] }

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'codeBlock',
  'blockquote',
  'image',
])

function collect(node: JSONContent, out: string[]) {
  if (node.type === 'text') {
    out.push(node.text ?? '')
    return
  }
  if (node.type === 'image') {
    const alt = (node.attrs?.alt as string | undefined) ?? ''
    if (alt) out.push(alt)
  }
  node.content?.forEach((child) => collect(child, out))
  if (node.type && BLOCK_TYPES.has(node.type)) out.push('\n')
}

/** Texto sem formatação, usado na busca e na IA. */
export function extrairTextoPlano(doc: JSONContent): string {
  const partes: string[] = []
  collect(doc, partes)
  return partes
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function gerarResumo(textoPlano: string, max = RESUMO_MAX): string {
  const linear = textoPlano.replace(/\s+/g, ' ').trim()
  if (linear.length <= max) return linear
  const corte = linear.slice(0, max)
  const ultimoEspaco = corte.lastIndexOf(' ')
  return `${(ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd()}…`
}

/** Retorna as imagens do documento sem texto alternativo. */
export function imagensSemAlt(doc: JSONContent): number {
  let total = 0
  const visitar = (node: JSONContent) => {
    if (node.type === 'image' && !String(node.attrs?.alt ?? '').trim()) total++
    node.content?.forEach(visitar)
  }
  visitar(doc)
  return total
}

/** Endereços (`src`) de todas as imagens do documento. */
export function extrairImagens(doc: JSONContent): string[] {
  const urls: string[] = []
  const visitar = (node: JSONContent) => {
    if (node.type === 'image' && node.attrs?.src)
      urls.push(String(node.attrs.src))
    node.content?.forEach(visitar)
  }
  visitar(doc)
  return urls
}

/** Endereços (`href`) de todos os links do documento. */
export function extrairLinks(doc: JSONContent): string[] {
  const urls: string[] = []
  const visitar = (node: JSONContent) => {
    for (const mark of node.marks ?? []) {
      if (mark.type === 'link' && mark.attrs?.href)
        urls.push(String(mark.attrs.href))
    }
    node.content?.forEach(visitar)
  }
  visitar(doc)
  return urls
}
