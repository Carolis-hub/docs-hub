/** Minúsculas e sem acentos, para comparar termos e textos. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const SEM_RADICAL = new Set(['jamais', 'demais', 'depois', 'pois'])

/**
 * Reduz o plural ao singular, para "relatórios" achar "relatório" e
 * "permissões" achar "permissão". Recebe o termo já normalizado (sem acento).
 * É de propósito leve: só plural. Conjugações e derivações ("configurar",
 * "configuração") continuam por conta do prefixo e da tolerância a erro.
 */
export function radical(termo: string): string {
  if (termo.length <= 3 || !termo.endsWith('s') || SEM_RADICAL.has(termo)) {
    return termo
  }
  const troca = (fim: string, novo: string, minimo: number) =>
    termo.endsWith(fim) && termo.length - fim.length >= minimo
      ? termo.slice(0, -fim.length) + novo
      : null
  return (
    troca('oes', 'ao', 2) ?? // permissoes → permissao
    troca('aes', 'ao', 2) ?? // capitaes → capitao
    troca('ais', 'al', 3) ?? // manuais → manual
    troca('eis', 'el', 3) ?? // niveis → nivel
    troca('ois', 'ol', 3) ?? // lencois → lencol
    troca('ns', 'm', 2) ?? // itens → item
    troca('s', '', 3) ?? // relatorios → relatorio
    termo
  )
}

/** O radical e os plurais que ele pode ter no texto, para destacar o trecho. */
export function formasDoRadical(termo: string): string[] {
  const formas = [termo]
  const plural = (fim: string, novo: string) => {
    if (termo.endsWith(fim)) formas.push(termo.slice(0, -fim.length) + novo)
  }
  plural('ao', 'oes')
  plural('ao', 'aes')
  plural('al', 'ais')
  plural('el', 'eis')
  plural('ol', 'ois')
  plural('m', 'ns')
  return formas
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
