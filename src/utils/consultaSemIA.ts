import type { IndexedItem } from '../types/search'
import { consultasLocais, limparPergunta } from './consulta'
import { gerarTrecho, type TrechoParte } from './search'
import type { SearchEngine, SearchFilters } from './searchEngine'

export interface ResultadoSemIA {
  item: IndexedItem
  trecho: TrechoParte[]
}

/**
 * Consulta sem a IA: procura a pergunta direto no índice de busca (o mesmo da
 * tela de busca), sem depender do servidor do assistente. Tira as palavras
 * comuns ("como", "um"…), tenta os sinônimos e, se nenhum artigo tiver todas
 * as palavras, aceita os que têm parte delas. Devolve os artigos mais
 * relevantes, com um trecho; não escreve resposta.
 */
export function consultarSemIA(
  motor: SearchEngine,
  pergunta: string,
  filtros: SearchFilters = {},
  limite = 5,
): ResultadoSemIA[] {
  const achados = new Map<
    string,
    { item: IndexedItem; score: number; termos: Set<string> }
  >()
  const somar = (consulta: string, combinar: 'AND' | 'OR') => {
    for (const h of motor.buscar(consulta, { ...filtros, combinar })) {
      const atual = achados.get(h.item.id)
      if (atual) {
        atual.score = Math.max(atual.score, h.score)
        h.termos.forEach((t) => atual.termos.add(t))
      } else {
        achados.set(h.item.id, {
          item: h.item,
          score: h.score,
          termos: new Set(h.termos),
        })
      }
    }
  }
  for (const consulta of consultasLocais(pergunta)) somar(consulta, 'AND')
  if (achados.size === 0) somar(limparPergunta(pergunta), 'OR')

  return [...achados.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(({ item, termos }) => ({
      item,
      trecho: gerarTrecho(item.textoPlano || item.resumo, [...termos]),
    }))
}
