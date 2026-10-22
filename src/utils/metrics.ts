import type { Article } from '../types/content'

export interface DailyView {
  articleId: string
  dia: string
  count: number
}

export interface DayPoint {
  dia: string
  count: number
}

const dois = (n: number) => String(n).padStart(2, '0')

/** Dia no fuso local, no formato AAAA-MM-DD (id de `viewsDaily`). */
export function diaLocal(data: Date): string {
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`
}

/** Chave usada no navegador para contar no máximo 1 acesso por leitor, artigo e dia. */
export function chaveVisualizacao(
  uid: string,
  articleId: string,
  dia: string,
): string {
  return `docshub:view:${uid}:${articleId}:${dia}`
}

/** Os últimos `n` dias, do mais antigo ao de hoje. */
export function ultimosDias(n: number, hoje: Date): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    d.setDate(d.getDate() - (n - 1 - i))
    return diaLocal(d)
  })
}

export function serieDiaria(
  dias: string[],
  registros: DailyView[],
): DayPoint[] {
  const porDia = new Map<string, number>()
  for (const r of registros) {
    porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.count)
  }
  return dias.map((dia) => ({ dia, count: porDia.get(dia) ?? 0 }))
}

export function viewsPorArtigo(registros: DailyView[]): Map<string, number> {
  const mapa = new Map<string, number>()
  for (const r of registros) {
    mapa.set(r.articleId, (mapa.get(r.articleId) ?? 0) + r.count)
  }
  return mapa
}

export interface RankedArticle {
  artigo: Article
  noPeriodo: number
}

/** Artigos publicados com mais acessos no período (empate: mais acessos no total). */
export function maisAcessados(
  artigos: Article[],
  noPeriodo: Map<string, number>,
  limite = 10,
): RankedArticle[] {
  return artigos
    .filter((a) => a.status === 'published')
    .map((artigo) => ({ artigo, noPeriodo: noPeriodo.get(artigo.id) ?? 0 }))
    .filter((r) => r.noPeriodo > 0)
    .sort(
      (a, b) => b.noPeriodo - a.noPeriodo || b.artigo.views - a.artigo.views,
    )
    .slice(0, limite)
}

/** Publicados que nunca foram acessados (`views` total igual a zero). */
export function semAcesso(artigos: Article[]): Article[] {
  return artigos
    .filter((a) => a.status === 'published' && (a.views ?? 0) === 0)
    .sort((a, b) => a.titulo.localeCompare(b.titulo))
}

/** Publicados cuja última revisão passou de `meses` meses. Os mais antigos primeiro. */
export function semRevisao(
  artigos: Article[],
  meses: number,
  agora: Date,
): Article[] {
  const limite = new Date(agora)
  limite.setMonth(limite.getMonth() - meses)
  return artigos
    .filter((a) => a.status === 'published' && a.revisadoEm < limite.getTime())
    .sort((a, b) => a.revisadoEm - b.revisadoEm)
}
