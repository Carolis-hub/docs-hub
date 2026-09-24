import type { JSONContent } from '@tiptap/core'

const RESUMO_TAMANHO_MAXIMO = 200

export function extrairTextoPlano(conteudo: JSONContent): string {
  const partes: string[] = []

  function visitar(node: JSONContent) {
    if (node.type === 'text' && node.text) {
      partes.push(node.text)
    }
    if (node.content) {
      node.content.forEach(visitar)
    }
    if (node.type === 'paragraph' || node.type?.startsWith('heading')) {
      partes.push('\n')
    }
  }

  visitar(conteudo)

  return partes
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

export function gerarResumo(
  textoPlano: string,
  tamanhoMaximo = RESUMO_TAMANHO_MAXIMO,
): string {
  const textoLimpo = textoPlano.replace(/\n+/g, ' ').trim()

  if (textoLimpo.length <= tamanhoMaximo) {
    return textoLimpo
  }

  const cortado = textoLimpo.slice(0, tamanhoMaximo)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  const base = ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado

  return `${base}…`
}
