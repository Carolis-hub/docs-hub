import { createHash } from 'node:crypto'
import path from 'node:path'

/** Um arquivo `.md` com as regras de um produto ou funcionalidade. */
export interface Regras {
  /** Caminho de origem (relativo ao repositório que o guarda). */
  arquivo: string
  /** Hash do conteúdo inteiro: identifica esta versão das regras. */
  hash: string
  titulo: string
  /** Id do produto (bloco raiz) no docs-hub, se o arquivo disser. */
  produto?: string
  /** Ids dos artigos a atualizar, se o arquivo disser. */
  artigos: string[]
  corpo: string
}

function lista(valor: string | undefined): string[] {
  return (valor ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((v) => v.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/**
 * Lê as regras. O front matter é opcional:
 *
 *     ---
 *     titulo: Anexos em atividades
 *     produto: m-smartshare
 *     artigos: m-101, m-102
 *     ---
 */
export function lerRegras(arquivo: string, texto: string): Regras {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto)
  const meta: Record<string, string> = {}
  if (m) {
    for (const linha of (m[1] ?? '').split(/\r?\n/)) {
      const i = linha.indexOf(':')
      if (i > 0) meta[linha.slice(0, i).trim()] = linha.slice(i + 1).trim()
    }
  }
  const corpo = m ? texto.slice(m[0].length) : texto
  const h1 = /^#\s+(.+)$/m.exec(corpo)?.[1]?.trim()
  return {
    arquivo,
    hash: createHash('sha256').update(texto).digest('hex'),
    titulo:
      meta.titulo?.replace(/^["']|["']$/g, '') ||
      h1 ||
      path.basename(arquivo, path.extname(arquivo)),
    produto: meta.produto?.replace(/^["']|["']$/g, '') || undefined,
    artigos: lista(meta.artigos),
    corpo: corpo.trim(),
  }
}

/** Texto usado para achar artigos parecidos: título e títulos de seção. */
export function consultaDeBusca(r: Regras): string {
  const titulos = [...r.corpo.matchAll(/^#{1,3}\s+(.+)$/gm)].map(
    (x) => x[1] ?? '',
  )
  return [r.titulo, ...titulos].join(' ')
}
