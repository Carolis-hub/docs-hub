import { generateJSON } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import { marked } from 'marked'
import type { ResultadoImagem } from './images.ts'
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
  resolverImagem(src: string): Promise<ResultadoImagem>
  resolverLink(href: string): Promise<LinkResolvido>
  aoFalharImagem(src: string, motivo: string): void
  aoGerarAlt(src: string, alt: string): void
  aoQuebrarLink(href: string, motivo: string): void
}

/**
 * O nó de imagem do editor é um bloco e não aceita link: `<a><img></a>` perdia
 * o link sem aviso. Aqui a imagem fica e o link vira um parágrafo de texto
 * logo abaixo (rótulo: o alt da imagem ou o domínio do destino).
 */
export function separarImagensComLink(html: string): {
  html: string
  total: number
} {
  let total = 0
  const saida = html.replace(
    /<a\s[^>]*?href=(["'])(.*?)\1[^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi,
    (_m, _q: string, href: string, img: string) => {
      total++
      const alt = /\balt=(["'])(.*?)\1/i.exec(img)?.[2]?.trim()
      let rotulo = alt
      if (!rotulo) {
        try {
          rotulo = new URL(href).hostname
        } catch {
          rotulo = href
        }
      }
      return `${img}<p><a href="${href}">${rotulo}</a></p>`
    },
  )
  return { html: saida, total }
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
    if ('pulada' in resultado || 'erro' in resultado) {
      if ('erro' in resultado) deps.aoFalharImagem(src, resultado.erro)
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
    // O Markdown/HTML gera um parágrafo vazio ao lado de cada imagem (o nó
    // de imagem do editor é um bloco). Parágrafos vazios só servem em itens de lista.
    const vazio = novo?.type === 'paragraph' && !novo.content?.length
    if (novo && !(vazio && no.type !== 'listItem')) filhos.push(novo)
  }
  // `marked` termina cada bloco de código com uma quebra de linha extra.
  const ultimo = filhos[filhos.length - 1]
  if (no.type === 'codeBlock' && ultimo?.text?.endsWith('\n')) {
    ultimo.text = ultimo.text.slice(0, -1)
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
): Promise<{
  doc: JSONContent
  naoSuportados: string[]
  imagensComLink: number
}> {
  const separado = separarImagensComLink(paraHtml(fonte, formato))
  const html = separado.html
  const bruto = generateJSON(html, extensions) as JSONContent
  const doc = (await transformar(bruto, deps, { imagens: 0 })) ?? bruto
  return {
    doc,
    naoSuportados: elementosNaoSuportados(html),
    imagensComLink: separado.total,
  }
}
