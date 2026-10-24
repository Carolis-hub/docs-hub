/** Minúsculas e sem acentos, para comparar termos e textos. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Igual a `normalizar`, mas garante o mesmo tamanho do original (1 char → 1 char). */
function normalizarMesmoTamanho(texto: string): string {
  let saida = ''
  for (const ch of texto) {
    const n = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    saida += n.length === ch.length ? n : ch.toLowerCase().slice(0, ch.length)
  }
  return saida
}

export interface TrechoParte {
  texto: string
  destaque: boolean
}

/**
 * Recorta um trecho do texto ao redor da primeira ocorrência de algum termo
 * e marca as ocorrências para destaque. Ignora acentos e maiúsculas.
 */
export function gerarTrecho(
  texto: string,
  termos: string[],
  tamanho = 180,
): TrechoParte[] {
  const linear = texto.replace(/\s+/g, ' ').trim()
  const alvo = normalizarMesmoTamanho(linear)
  const buscados = [...new Set(termos.map(normalizar).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )

  const ocorrencias: Array<[number, number]> = []
  for (const termo of buscados) {
    let pos = alvo.indexOf(termo)
    while (pos !== -1) {
      ocorrencias.push([pos, pos + termo.length])
      pos = alvo.indexOf(termo, pos + termo.length)
    }
  }
  ocorrencias.sort((a, b) => a[0] - b[0])

  let inicio = 0
  if (ocorrencias.length > 0) {
    const [primeira = 0] = ocorrencias[0] ?? []
    inicio = Math.max(0, primeira - Math.floor(tamanho / 3))
    const espaco = linear.lastIndexOf(' ', inicio)
    if (inicio > 0 && espaco >= 0 && inicio - espaco < 20) inicio = espaco + 1
  }
  const fim = Math.min(linear.length, inicio + tamanho)

  const partes: TrechoParte[] = []
  let cursor = inicio
  for (const [de, ate] of ocorrencias) {
    if (ate <= cursor || de >= fim) continue
    const ini = Math.max(de, cursor)
    const fi = Math.min(ate, fim)
    if (ini > cursor) {
      partes.push({ texto: linear.slice(cursor, ini), destaque: false })
    }
    partes.push({ texto: linear.slice(ini, fi), destaque: true })
    cursor = fi
  }
  if (cursor < fim)
    partes.push({ texto: linear.slice(cursor, fim), destaque: false })

  const primeiro = partes[0]
  const ultimo = partes[partes.length - 1]
  if (inicio > 0 && primeiro) primeiro.texto = `…${primeiro.texto}`
  if (fim < linear.length && ultimo) ultimo.texto += '…'
  return partes
}
