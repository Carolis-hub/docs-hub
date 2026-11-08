import type { Article, Block, Unidade } from '../types/content'
import { comDescendentes } from './blocos.ts'

export interface Barra {
  id: string
  nome: string
  total: number
}

export interface MetricasEstrutura {
  unidades: number
  produtos: number
  subprodutos: number
  modulos: number
  modulosDocumentados: number
  /** 0 a 100; `null` quando não há módulos para medir. */
  cobertura: number | null
  artigos: number
  publicados: number
  rascunhos: number
  visualizacoes: number
  desatualizados: number
  porUnidade: Barra[]
  porProduto: Barra[]
  /** Últimos 12 meses (do mais antigo ao atual): artigos publicados atualizados no mês. */
  porMes: { chave: string; rotulo: string; total: number }[]
}

const DIA = 24 * 60 * 60 * 1000
const MESES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

export function profundidadeDe(blocos: Block[], id: string): number {
  const porId = new Map(blocos.map((b) => [b.id, b]))
  let n = 0
  let atual = porId.get(id)
  while (atual?.parentId) {
    n += 1
    atual = porId.get(atual.parentId)
  }
  return n
}

/**
 * Números da estrutura (BU, produto, subproduto, módulo) para o painel de
 * métricas. Módulo é todo bloco a partir do terceiro nível; "documentado" é o
 * que tem ao menos um artigo publicado nele ou abaixo dele.
 */
export function metricasDaEstrutura(
  blocos: Block[],
  unidades: Unidade[],
  artigos: Article[],
  unidadeId: string,
  agora: Date,
): MetricasEstrutura {
  const produtosTodos = blocos.filter((b) => b.parentId === null)
  const produtos = produtosTodos.filter(
    (p) => !unidadeId || p.unidadeId === unidadeId,
  )
  const idsProdutos = new Set(produtos.map((p) => p.id))
  const blocosDoFiltro = blocos.filter((b) => idsProdutos.has(b.productId))
  const artigosDoFiltro = artigos.filter((a) => idsProdutos.has(a.productId))
  const publicadosLista = artigosDoFiltro.filter(
    (a) => a.status === 'published',
  )

  const modulos = blocosDoFiltro.filter(
    (b) => profundidadeDe(blocosDoFiltro, b.id) >= 2,
  )
  const blocosComArtigo = new Set(publicadosLista.map((a) => a.blockId))
  const modulosDocumentados = modulos.filter((m) =>
    [...comDescendentes(blocosDoFiltro, m.id)].some((id) =>
      blocosComArtigo.has(id),
    ),
  ).length

  const limite = agora.getTime() - 180 * DIA
  const contar = (lista: Article[]) => lista.length

  const unidadesDoFiltro = unidades.filter(
    (u) => !unidadeId || u.id === unidadeId,
  )
  const porUnidade = unidadesDoFiltro.map((u) => ({
    id: u.id,
    nome: u.nome,
    total: contar(
      publicadosLista.filter((a) =>
        produtosTodos.some((p) => p.id === a.productId && p.unidadeId === u.id),
      ),
    ),
  }))
  const porProduto = produtos
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      total: contar(publicadosLista.filter((a) => a.productId === p.id)),
    }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))

  const porMes = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (11 - i), 1)
    return {
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      rotulo: MESES[d.getMonth()] as string,
      total: 0,
    }
  })
  for (const a of publicadosLista) {
    const d = new Date(a.atualizadoEm)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const mes = porMes.find((m) => m.chave === chave)
    if (mes) mes.total += 1
  }

  return {
    unidades: unidadesDoFiltro.length,
    produtos: produtos.length,
    subprodutos: blocosDoFiltro.filter(
      (b) => profundidadeDe(blocosDoFiltro, b.id) === 1,
    ).length,
    modulos: modulos.length,
    modulosDocumentados,
    cobertura: modulos.length
      ? Math.round((modulosDocumentados / modulos.length) * 100)
      : null,
    artigos: artigosDoFiltro.length,
    publicados: publicadosLista.length,
    rascunhos: artigosDoFiltro.filter((a) => a.status === 'draft').length,
    visualizacoes: artigosDoFiltro.reduce((s, a) => s + (a.views ?? 0), 0),
    desatualizados: publicadosLista.filter((a) => a.revisadoEm < limite).length,
    porUnidade,
    porProduto,
    porMes,
  }
}
