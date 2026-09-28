import { normalizarTexto } from './textoNormalizado'

const RAIO_CONTEXTO = 60

export interface TrechoDestacado {
  antes: string
  destaque: string
  depois: string
}

/**
 * Encontra a primeira ocorrência de um dos termos em `texto` (ignorando
 * acentos e maiúsculas/minúsculas) e retorna um recorte com o trecho ao
 * redor, para destacar na página de resultados.
 */
export function gerarTrecho(
  texto: string,
  termos: string[],
  raio = RAIO_CONTEXTO,
): TrechoDestacado | null {
  const textoNormalizado = normalizarTexto(texto)

  let indiceEncontrado = -1
  let tamanhoEncontrado = 0

  for (const termo of termos) {
    const termoNormalizado = normalizarTexto(termo)
    if (!termoNormalizado) continue
    const indice = textoNormalizado.indexOf(termoNormalizado)
    if (
      indice !== -1 &&
      (indiceEncontrado === -1 || indice < indiceEncontrado)
    ) {
      indiceEncontrado = indice
      tamanhoEncontrado = termoNormalizado.length
    }
  }

  if (indiceEncontrado === -1) {
    return {
      antes: '',
      destaque: '',
      depois: texto.slice(0, raio * 2),
    }
  }

  const inicio = Math.max(0, indiceEncontrado - raio)
  const fim = Math.min(
    texto.length,
    indiceEncontrado + tamanhoEncontrado + raio,
  )

  return {
    antes: (inicio > 0 ? '…' : '') + texto.slice(inicio, indiceEncontrado),
    destaque: texto.slice(
      indiceEncontrado,
      indiceEncontrado + tamanhoEncontrado,
    ),
    depois:
      texto.slice(indiceEncontrado + tamanhoEncontrado, fim) +
      (fim < texto.length ? '…' : ''),
  }
}
