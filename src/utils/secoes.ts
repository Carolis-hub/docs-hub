import type { JSONContent } from '@tiptap/react'
import type { SearchItem, SecaoIndice } from '../types/search'
import { extrairTextoPlano } from './content.ts'
import { normalizar } from './search.ts'

const MAX_SECOES = 80
const MAX_TITULO = 120

function textoDe(no: JSONContent): string {
  if (no.type === 'text') return no.text ?? ''
  return (no.content ?? []).map(textoDe).join('')
}

/**
 * Onde começa, dentro do texto plano do artigo, cada seção (título H1 a H3).
 * Guardar só a posição custa poucos bytes no índice e deixa a busca apontar
 * para o trecho do artigo em vez do artigo inteiro.
 */
export function extrairSecoes(doc: JSONContent | undefined): SecaoIndice[] {
  const nos = doc?.content ?? []
  const saida: SecaoIndice[] = []
  nos.forEach((no, k) => {
    if (no.type !== 'heading' || saida.length >= MAX_SECOES) return
    const titulo = textoDe(no).replace(/\s+/g, ' ').trim()
    if (!titulo) return
    // O texto plano do que vem antes diz em que posição este título cai.
    const antes = extrairTextoPlano({ type: 'doc', content: nos.slice(0, k) })
    saida.push({
      t: titulo.slice(0, MAX_TITULO),
      i: antes.length > 0 ? antes.length + 1 : 0,
    })
  })
  return saida
}

export interface Secao {
  /** Título da seção; `''` para o texto que vem antes do primeiro título. */
  titulo: string
  texto: string
}

/** Divide o texto indexado do artigo pelas seções gravadas no índice. */
export function dividirEmSecoes(
  item: Pick<SearchItem, 'textoPlano' | 'secoes'>,
): Secao[] {
  const texto = item.textoPlano
  // O texto pode ter sido encurtado para caber no índice: seções além do corte somem.
  const marcas = (item.secoes ?? [])
    .filter((s) => s.i < texto.length)
    .sort((a, b) => a.i - b.i)
  if (marcas.length === 0) return texto ? [{ titulo: '', texto }] : []
  const saida: Secao[] = []
  const intro = texto.slice(0, marcas[0]!.i).trim()
  if (intro) saida.push({ titulo: '', texto: intro })
  marcas.forEach((m, k) => {
    const fim = marcas[k + 1]?.i ?? texto.length
    saida.push({ titulo: m.t, texto: texto.slice(m.i, fim).trim() })
  })
  return saida
}

/**
 * A seção do artigo que melhor responde à busca: a que tem mais termos
 * diferentes, depois a que os repete mais, com um empurrão quando o termo
 * está no próprio título da seção. `undefined` se nenhuma seção com título
 * casa (o resultado então aponta para o artigo inteiro).
 */
export function melhorSecao(
  item: Pick<SearchItem, 'textoPlano' | 'secoes'>,
  termos: string[],
): Secao | undefined {
  const buscados = [...new Set(termos.map(normalizar).filter(Boolean))]
  if (buscados.length === 0) return undefined
  let melhor: Secao | undefined
  let melhorPontos = 0
  for (const secao of dividirEmSecoes(item)) {
    const corpo = normalizar(secao.texto)
    const titulo = normalizar(secao.titulo)
    let pontos = 0
    for (const termo of buscados) {
      const vezes = corpo.split(termo).length - 1
      if (vezes === 0) continue
      pontos += 100 + Math.min(vezes, 9) + (titulo.includes(termo) ? 30 : 0)
    }
    if (pontos > melhorPontos) {
      melhorPontos = pontos
      melhor = secao
    }
  }
  return melhor?.titulo ? melhor : undefined
}
