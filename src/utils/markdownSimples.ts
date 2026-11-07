/** Trecho de texto de uma linha da resposta. */
export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; texto: string }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'citacao'; numero: number }

export type BlocoResposta =
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'lista'; ordenada: boolean; itens: Trecho[][] }

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[(\d{1,3})\]/g

/** Quebra uma linha em texto, **negrito**, `código` e citações [n]. Nada vira HTML. */
export function trechosDaLinha(linha: string): Trecho[] {
  const saida: Trecho[] = []
  let cursor = 0
  for (const m of linha.matchAll(INLINE)) {
    const inicio = m.index ?? 0
    if (inicio > cursor)
      saida.push({ tipo: 'texto', texto: linha.slice(cursor, inicio) })
    if (m[1] !== undefined) saida.push({ tipo: 'negrito', texto: m[1] })
    else if (m[2] !== undefined) saida.push({ tipo: 'codigo', texto: m[2] })
    else saida.push({ tipo: 'citacao', numero: Number(m[3]) })
    cursor = inicio + m[0].length
  }
  if (cursor < linha.length)
    saida.push({ tipo: 'texto', texto: linha.slice(cursor) })
  return saida
}

/**
 * Lê o formato pedido à IA (parágrafos, listas com "-" ou "1." e **negrito**)
 * e devolve uma estrutura simples para desenhar na tela sem `innerHTML`, de
 * modo que nem um HTML malicioso na resposta chega a ser interpretado.
 */
export function lerResposta(texto: string): BlocoResposta[] {
  const blocos: BlocoResposta[] = []
  let paragrafo: string[] = []
  let lista: { ordenada: boolean; itens: Trecho[][] } | null = null

  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({
        tipo: 'paragrafo',
        trechos: trechosDaLinha(paragrafo.join(' ')),
      })
      paragrafo = []
    }
  }
  const fecharLista = () => {
    if (lista) {
      blocos.push({ tipo: 'lista', ...lista })
      lista = null
    }
  }

  for (const bruta of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim()
    const item = /^(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/.exec(linha)
    if (!linha) {
      fecharParagrafo()
      fecharLista()
    } else if (item) {
      fecharParagrafo()
      const ordenada = item[2] !== undefined
      if (lista && lista.ordenada !== ordenada) fecharLista()
      lista ??= { ordenada, itens: [] }
      lista.itens.push(trechosDaLinha(item[3] ?? ''))
    } else {
      fecharLista()
      paragrafo.push(linha)
    }
  }
  fecharParagrafo()
  fecharLista()
  return blocos
}
