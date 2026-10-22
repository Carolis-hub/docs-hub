import type { JSONContent } from '@tiptap/react'

/** Escapa o que o Markdown interpretaria como formatação dentro de um texto. */
function escapar(texto: string): string {
  return texto.replace(/([\\`*_[\]<>])/g, '\\$1')
}

function inline(nos: JSONContent[] | undefined): string {
  return (nos ?? []).map(umInline).join('')
}

function umInline(no: JSONContent): string {
  if (no.type === 'hardBreak') return '  \n'
  if (no.type === 'image') return imagem(no)
  if (no.type !== 'text') return inline(no.content)

  const marcas = no.marks ?? []
  const codigo = marcas.some((m) => m.type === 'code')
  let texto = codigo ? (no.text ?? '') : escapar(no.text ?? '')
  // Espaços nas pontas ficam fora das marcas, que o Markdown não aceita coladas neles.
  const [, antes = '', meio = '', depois = ''] =
    /^(\s*)([\s\S]*?)(\s*)$/.exec(texto) ?? []
  if (!meio) return texto
  texto = meio
  for (const m of marcas) {
    if (m.type === 'code') texto = `\`${texto}\``
    else if (m.type === 'bold') texto = `**${texto}**`
    else if (m.type === 'italic') texto = `*${texto}*`
    else if (m.type === 'strike') texto = `~~${texto}~~`
    else if (m.type === 'link')
      texto = `[${texto}](${String(m.attrs?.href ?? '')})`
  }
  return antes + texto + depois
}

function imagem(no: JSONContent): string {
  const alt = String(no.attrs?.alt ?? '').replace(/[[\]]/g, '')
  return `![${alt}](${String(no.attrs?.src ?? '')})`
}

function indentar(texto: string, prefixo: string, prefixoContinuacao: string) {
  return texto
    .split('\n')
    .map((l, i) =>
      l === '' ? l : (i === 0 ? prefixo : prefixoContinuacao) + l,
    )
    .join('\n')
}

function lista(no: JSONContent): string {
  const ordenada = no.type === 'orderedList'
  const inicio = Number(no.attrs?.start ?? 1)
  return (no.content ?? [])
    .map((item, i) => {
      const marcador = ordenada ? `${inicio + i}. ` : '- '
      const corpo = blocos(item.content, '\n').trim()
      return indentar(corpo, marcador, ' '.repeat(marcador.length))
    })
    .join('\n')
}

function bloco(no: JSONContent): string {
  switch (no.type) {
    case 'paragraph':
      return inline(no.content)
    case 'heading':
      return `${'#'.repeat(Number(no.attrs?.level ?? 1))} ${inline(no.content)}`
    case 'bulletList':
    case 'orderedList':
      return lista(no)
    case 'codeBlock': {
      const texto = (no.content ?? []).map((n) => n.text ?? '').join('')
      const lang = String(no.attrs?.language ?? '')
      return `\`\`\`${lang}\n${texto}\n\`\`\``
    }
    case 'blockquote':
      return indentar(blocos(no.content, '\n\n'), '> ', '> ')
    case 'horizontalRule':
      return '---'
    case 'image':
      return imagem(no)
    default:
      return blocos(no.content, '\n\n')
  }
}

function blocos(nos: JSONContent[] | undefined, sep: string): string {
  return (nos ?? [])
    .map(bloco)
    .filter((b) => b !== '')
    .join(sep)
}

/**
 * Serializa o JSON do editor em Markdown, o formato em que a IA lê e escreve
 * artigos. Cobre os nós do editor (títulos, listas, código, citação, imagem,
 * links e as marcas de texto).
 */
export function docParaMarkdown(doc: JSONContent): string {
  const md = blocos(doc.content, '\n\n')
  return md ? `${md}\n` : ''
}
