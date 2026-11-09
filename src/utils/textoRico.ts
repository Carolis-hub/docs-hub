import { urlSegura } from './ficha.ts'

export type Pedaco =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; texto: string }
  | { tipo: 'link'; texto: string; url: string }

/**
 * Lê um texto curto com **negrito** e endereços (https://… ou mailto:…). Cada
 * linha em branco separa um parágrafo.
 */
export function lerTextoRico(texto: string): Pedaco[][] {
  const paragrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return paragrafos.map((p) => {
    const saida: Pedaco[] = []
    const re = /\*\*([^*]+)\*\*|((?:https?:\/\/|mailto:)[^\s<>"]+)/gi
    let ultimo = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(p))) {
      if (m.index > ultimo) {
        saida.push({ tipo: 'texto', texto: p.slice(ultimo, m.index) })
      }
      if (m[1] !== undefined) saida.push({ tipo: 'negrito', texto: m[1] })
      else {
        // A pontuação no fim da frase não faz parte do endereço.
        const endereco = (m[2] as string).replace(/[.,;:!?)]+$/, '')
        const url = urlSegura(endereco)
        saida.push(
          url
            ? { tipo: 'link', texto: endereco, url }
            : { tipo: 'texto', texto: endereco },
        )
        re.lastIndex = m.index + endereco.length
      }
      ultimo =
        m.index +
        (m[1] !== undefined
          ? m[0].length
          : (m[2] as string).replace(/[.,;:!?)]+$/, '').length)
    }
    if (ultimo < p.length) saida.push({ tipo: 'texto', texto: p.slice(ultimo) })
    return saida
  })
}
