import type { JSONContent } from '@tiptap/react'

/** Uma imagem do artigo com o contexto que ajuda a descrevê-la. */
export interface ImagemComContexto {
  /** Posição da imagem no documento (0 = a primeira), em ordem de leitura. */
  indice: number
  src: string
  alt: string
  /** Último título antes da imagem. */
  secao: string
  /** Texto do bloco anterior à imagem. */
  antes: string
  /** Texto do bloco seguinte à imagem. */
  depois: string
}

const CONTEXTO_MAX = 300

type Evento =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'imagem'; src: string; alt: string }

function texto(no: JSONContent): string {
  if (no.type === 'text') return no.text ?? ''
  return (no.content ?? []).map(texto).join('')
}

function eventos(no: JSONContent, saida: Evento[]): void {
  if (no.type === 'image') {
    saida.push({
      tipo: 'imagem',
      src: String(no.attrs?.src ?? ''),
      alt: String(no.attrs?.alt ?? ''),
    })
    return
  }
  if (
    no.type === 'heading' ||
    no.type === 'paragraph' ||
    no.type === 'codeBlock'
  ) {
    const t = texto(no).replace(/\s+/g, ' ').trim()
    if (t)
      saida.push({ tipo: no.type === 'heading' ? 'titulo' : 'texto', texto: t })
    return
  }
  no.content?.forEach((filho) => eventos(filho, saida))
}

const cortar = (t: string) =>
  t.length > CONTEXTO_MAX ? `${t.slice(0, CONTEXTO_MAX)}…` : t

/** Lista as imagens do documento, em ordem, cada uma com o texto ao redor. */
export function imagensComContexto(doc: JSONContent): ImagemComContexto[] {
  const seq: Evento[] = []
  eventos(doc, seq)
  const imagens: ImagemComContexto[] = []
  let secao = ''
  let antes = ''
  seq.forEach((ev, i) => {
    if (ev.tipo === 'titulo') {
      secao = ev.texto
      antes = ev.texto
    } else if (ev.tipo === 'texto') {
      antes = ev.texto
    } else {
      const proximo = seq
        .slice(i + 1)
        .find(
          (e): e is Extract<Evento, { texto: string }> => e.tipo !== 'imagem',
        )
      imagens.push({
        indice: imagens.length,
        src: ev.src,
        alt: ev.alt,
        secao: cortar(secao),
        antes: cortar(antes),
        depois: proximo ? cortar(proximo.texto) : '',
      })
    }
  })
  return imagens
}

/** Devolve uma cópia do documento com o alt das imagens trocado (por índice). */
export function aplicarAlts(
  doc: JSONContent,
  alts: ReadonlyMap<number, string>,
): JSONContent {
  let indice = 0
  const visitar = (no: JSONContent): JSONContent => {
    if (no.type === 'image') {
      const i = indice++
      const novo = alts.get(i)
      return novo === undefined
        ? no
        : { ...no, attrs: { ...no.attrs, alt: novo } }
    }
    return no.content ? { ...no, content: no.content.map(visitar) } : no
  }
  return visitar(doc)
}

/** Alt vazio ou o genérico que o importador gera ("Imagem 2 do artigo …"). */
export function altFraco(alt: string): boolean {
  const a = alt.trim()
  return a === '' || /^Imagem \d+ do artigo /i.test(a)
}

const ALT_MAX = 200

/** Limpa o texto devolvido pela IA. Devolve `null` se não sobrar um alt aproveitável. */
export function normalizarAlt(bruto: string): string | null {
  const alt = bruto
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”']+|["“”']+$/g, '')
    // "Imagem de …", "Print: …": o leitor de tela já anuncia que é uma imagem.
    .replace(
      /^(imagem|foto|print|captura|screenshot|figura)\s+(de|da|do|das|dos)\s+/i,
      '',
    )
    .replace(/^(imagem|foto|print|captura|screenshot|figura)\s*[:–-]\s*/i, '')
    .trim()
  if (!alt || /^(imagem|foto|print|captura|screenshot|figura)$/i.test(alt))
    return null
  const maiuscula = alt.charAt(0).toUpperCase() + alt.slice(1)
  return maiuscula.length > ALT_MAX
    ? `${maiuscula.slice(0, ALT_MAX - 1).trimEnd()}…`
    : maiuscula
}
