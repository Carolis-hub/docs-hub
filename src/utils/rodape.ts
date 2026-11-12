import type { ColunaRodape, ItemRodape, Rodape } from '../types/content'

export const LIMITES_RODAPE = {
  colunas: 6,
  itens: 12,
  titulo: 80,
  url: 500,
  conteudo: 2000,
} as const

export function novoIdDoRodape(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** http(s), mailto e caminhos do próprio sistema (`/b/…`) viram link; o resto é descartado. */
export function urlDoRodape(url: string): string {
  const u = url.trim()
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u
  return /^\/(?!\/)/.test(u) ? u : ''
}

export const ehLinkInterno = (url: string) => /^\/(?!\/)/.test(url)

const corta = (t: string, max: number) => t.trim().slice(0, max)

/**
 * Deixa o rodapé pronto para gravar: corta nos limites, descarta links
 * inseguros e itens sem título. Devolve `null` quando não sobra nada, para que
 * o rodapé simplesmente não apareça (sem espaço vazio).
 */
export function normalizarRodape(
  rodape: Rodape | null | undefined,
): Rodape | null {
  const L = LIMITES_RODAPE
  const colunas = (rodape?.colunas ?? [])
    .slice(0, L.colunas)
    .flatMap((c): ColunaRodape[] => {
      const itens = (c.itens ?? [])
        .slice(0, L.itens)
        .flatMap((i): ItemRodape[] => {
          const titulo = corta(i.titulo ?? '', L.titulo)
          if (!titulo) return []
          return [
            {
              id: i.id || novoIdDoRodape(),
              titulo,
              url: urlDoRodape(corta(i.url ?? '', L.url)),
              // Só as pontas são aparadas: espaços e quebras de linha do meio importam no Markdown.
              conteudo: (i.conteudo ?? '').trim().slice(0, L.conteudo),
            },
          ]
        })
      const titulo = corta(c.titulo ?? '', L.titulo)
      if (!titulo && itens.length === 0) return []
      return [{ id: c.id || novoIdDoRodape(), titulo, itens }]
    })
  return colunas.length ? { colunas } : null
}

/** Há algo para mostrar? (ausência de configuração = sem rodapé) */
export const temRodape = (r: Rodape | null | undefined): r is Rodape =>
  normalizarRodape(r) !== null

/** Troca o item de lugar com o vizinho (`delta` −1 ou +1); fora do limite, não muda nada. */
export function mover<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  const [item] = copia.splice(indice, 1)
  copia.splice(destino, 0, item as T)
  return copia
}
