import MiniSearch from 'minisearch'
import type { ArticlePublico, CategoriaId } from '../types/content'
import type { IndexedItem } from '../types/search'
import { limparPergunta, variantesComSinonimos } from './consulta.ts'
import { formasDoRadical, normalizar, radical } from './search.ts'
import { melhorSecao, type Secao } from './secoes.ts'

export interface SearchFilters {
  productId?: string
  /** Vários produtos de uma vez (ex.: todos os de uma unidade de negócio). */
  productIds?: readonly string[]
  /** Só artigos destes blocos (ex.: um subproduto e tudo dentro dele). */
  blockIds?: ReadonlySet<string>
  categoria?: CategoriaId
  publico?: ArticlePublico
  /**
   * Padrão: todas as palavras (`AND`) e, se nada casar, a maior parte delas.
   * Informar `AND` ou `OR` desliga essa segunda tentativa; `OR` serve para
   * consultas longas (ex.: casar um texto com artigos).
   */
  combinar?: 'AND' | 'OR'
}

export interface SearchHit {
  item: IndexedItem
  score: number
  /** Termos do texto que casaram, para destacar o trecho. */
  termos: string[]
  /** Seção do artigo que melhor responde à busca, quando o índice tem seções. */
  secao?: Secao
  /**
   * `true` quando nenhum artigo tinha todas as palavras da busca e este veio
   * por ter a maior parte delas.
   */
  parcial?: boolean
}

export interface OpcoesDoMotor {
  /**
   * Sinônimos do produto (grupos de termos já normalizados). A busca roda
   * também com cada troca, e o que só casa por sinônimo fica abaixo do que
   * casa com o texto digitado.
   */
  sinonimos?: readonly (readonly string[])[]
}

/** Peso de um resultado achado por sinônimo, em relação ao termo digitado. */
const PESO_SINONIMO = 0.7

export interface SearchEngine {
  total: number
  buscar(consulta: string, filtros?: SearchFilters): SearchHit[]
  /** Navegação sem texto: todos os artigos que passam nos filtros, de A a Z. */
  listar(filtros?: SearchFilters): IndexedItem[]
}

function passa(item: IndexedItem, f: SearchFilters): boolean {
  if (f.productId && item.productId !== f.productId) return false
  if (f.productIds && !f.productIds.includes(item.productId)) return false
  if (f.blockIds && !f.blockIds.has(item.blockId)) return false
  if (f.categoria && item.categoria !== f.categoria) return false
  return !f.publico || item.publico === f.publico
}

export function criarMotor(
  itens: IndexedItem[],
  verTecnico: boolean,
  opcoes: OpcoesDoMotor = {},
): SearchEngine {
  const sinonimos = opcoes.sinonimos ?? []
  const termoDeBusca = (termo: string) => radical(normalizar(termo))
  const visiveis = itens.filter((i) => verTecnico || i.publico !== 'tecnico')
  const mini = new MiniSearch<IndexedItem>({
    fields: ['titulo', 'resumo', 'textoPlano'],
    storeFields: ['id'],
    processTerm: termoDeBusca,
    searchOptions: {
      boost: { titulo: 4, resumo: 1.5 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
      processTerm: termoDeBusca,
    },
  })
  mini.addAll(visiveis)
  const porId = new Map(visiveis.map((i) => [i.id, i]))

  return {
    total: visiveis.length,
    listar(filtros = {}) {
      return visiveis
        .filter((i) => passa(i, filtros))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'))
    },
    buscar(consulta, filtros = {}) {
      if (!consulta.trim()) return []
      const rodar = (texto: string, combinar: 'AND' | 'OR') =>
        mini.search(texto, {
          combineWith: combinar,
          filter: (r) => {
            const item = porId.get(r.id as string)
            return !!item && passa(item, filtros)
          },
        })
      const achados = new Map<
        string,
        { score: number; termos: Set<string>; direto: boolean }
      >()
      const somar = (
        resultados: ReturnType<typeof rodar>,
        peso: number,
        direto: boolean,
      ) => {
        for (const r of resultados) {
          const id = r.id as string
          const atual = achados.get(id) ?? {
            score: 0,
            termos: new Set<string>(),
            direto: false,
          }
          if (direto) atual.direto = true
          atual.score = Math.max(atual.score, r.score * peso)
          Object.keys(r.match).forEach((t) => atual.termos.add(t))
          achados.set(id, atual)
        }
      }
      const combinar = filtros.combinar ?? 'AND'
      somar(rodar(consulta, combinar), 1, true)
      if (sinonimos.length > 0) {
        for (const variante of variantesComSinonimos(consulta, 6, sinonimos)) {
          somar(rodar(variante, combinar), PESO_SINONIMO, false)
        }
      }

      // Quem escreve uma frase ("baixar vários anexos de uma vez") não pode
      // ficar sem resposta por causa de uma palavra a mais. Se nada casou com
      // todas as palavras, tenta sem as palavras comuns ("de", "uma") e, por
      // fim, aceita os artigos que têm a maior parte das que sobraram.
      let parcial = false
      if (achados.size === 0 && filtros.combinar === undefined) {
        const limpa = limparPergunta(consulta)
        if (normalizar(limpa) !== normalizar(consulta.trim())) {
          somar(rodar(limpa, 'AND'), 1, true)
        }
        const palavras = new Set(
          limpa.split(/\s+/).map(termoDeBusca).filter(Boolean),
        )
        if (achados.size === 0 && palavras.size >= 2) {
          const minimo = Math.ceil(palavras.size / 2)
          somar(
            rodar(limpa, 'OR').filter(
              (r) => new Set(r.queryTerms).size >= minimo,
            ),
            1,
            true,
          )
          parcial = achados.size > 0
        }
      }
      return (
        [...achados.entries()]
          // Quem casou com o que foi digitado vem antes de quem só casou por sinônimo.
          .sort(
            (a, b) =>
              Number(b[1].direto) - Number(a[1].direto) ||
              b[1].score - a[1].score,
          )
          .map(([id, achado]) => {
            const item = porId.get(id) as IndexedItem
            // O índice guarda o radical: o destaque precisa também dos plurais.
            const termos = [...achado.termos].flatMap(formasDoRadical)
            const secao = melhorSecao(item, termos)
            return {
              item,
              score: achado.score,
              termos,
              ...(secao ? { secao } : {}),
              ...(parcial ? { parcial: true } : {}),
            }
          })
      )
    },
  }
}
