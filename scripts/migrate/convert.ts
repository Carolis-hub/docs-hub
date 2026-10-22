import { generateJSON } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import { marked } from 'marked'
import { extensions } from '../../src/components/editor/extensions.ts'

/** Elementos que o editor não suporta e que o texto "achata". */
const NAO_SUPORTADOS = [
  'table',
  'iframe',
  'video',
  'audio',
  'object',
  'embed',
  'form',
  'svg',
]

/**
 * `artigo:ID` não é um protocolo aceito pelo editor, que descartaria o link.
 * Antes da conversão ele vira um caminho relativo com este prefixo.
 */
export const PREFIXO_ARTIGO = 'migrar-artigo/'

export type LinkResolvido =
  { tipo: 'manter'; href: string } | { tipo: 'quebrado'; motivo: string }

export interface ConversaoDeps {
  titulo: string
  resolverImagem(src: string): Promise<{ url: string } | { erro: string }>
  resolverLink(href: string): Promise<LinkResolvido>
  aoFalharImagem(src: string, motivo: string): void
  aoGerarAlt(src: string, alt: string): void
  aoQuebrarLink(href: string, motivo: string): void
}

export function paraHtml(fonte: string, formato: 'html' | 'markdown'): string {
  const html =
    formato === 'markdown'
      ? (marked.parse(fonte, { async: false }) as string)
      : fonte
  return html
    .replace(/href=(["'])artigo:/gi, `href=$1${PREFIXO_ARTIGO}`)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
}

export function elementosNaoSuportados(html: string): string[] {
  return NAO_SUPORTADOS.filter((tag) =>
    new RegExp(`<${tag}[\\s>/]`, 'i').test(html),
  )
}

async function transformar(
  no: JSONContent,
  deps: ConversaoDeps,
  contador: { imagens: number },
): Promise<JSONContent | null> {
  if (no.type === 'image') {
    const src = String(no.attrs?.src ?? '')
    const resultado = await deps.resolverImagem(src)
    if ('erro' in resultado) {
      deps.aoFalharImagem(src, resultado.erro)
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: `[Imagem não migrada: ${src}]` }],
      }
    }
    contador.imagens++
    let alt = String(no.attrs?.alt ?? '').trim()
    if (!alt) {
      alt =
        String(no.attrs?.title ?? '').trim() ||
        `Imagem ${contador.imagens} do artigo "${deps.titulo}"`
      deps.aoGerarAlt(src, alt)
    }
    return { ...no, attrs: { ...no.attrs, src: resultado.url, alt } }
  }

  let marks = no.marks
  if (marks?.some((m) => m.type === 'link')) {
    const novas: NonNullable<JSONContent['marks']> = []
    for (const m of marks) {
      if (m.type !== 'link') {
        novas.push(m)
        continue
      }
      const href = String(m.attrs?.href ?? '')
      const r = await deps.resolverLink(href)
      if (r.tipo === 'quebrado') {
        deps.aoQuebrarLink(href, r.motivo)
        continue // mantém o texto, sem o link morto
      }
      novas.push({ ...m, attrs: { ...m.attrs, href: r.href } })
    }
    marks = novas.length ? novas : undefined
  }

  const filhos: JSONContent[] = []
  for (const filho of no.content ?? []) {
    const novo = await transformar(filho, deps, contador)
    if (novo) filhos.push(novo)
  }
  const resultado: JSONContent = { ...no }
  if (no.content) resultado.content = filhos
  if (no.marks) {
    if (marks) resultado.marks = marks
    else delete resultado.marks
  }
  return resultado
}

/** Converte HTML ou Markdown no JSON do TipTap, migrando imagens e links. */
export async function converter(
  fonte: string,
  formato: 'html' | 'markdown',
  deps: ConversaoDeps,
): Promise<{ doc: JSONContent; naoSuportados: string[] }> {
  const html = paraHtml(fonte, formato)
  const bruto = generateJSON(html, extensions) as JSONContent
  const doc = (await transformar(bruto, deps, { imagens: 0 })) ?? bruto
  return { doc, naoSuportados: elementosNaoSuportados(html) }
}
