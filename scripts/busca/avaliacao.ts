import type { Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { Block } from '../../src/types/content.ts'
import type { IndexedItem } from '../../src/types/search.ts'
import { normalizar } from '../../src/utils/search.ts'
import { criarMotor, type SearchEngine } from '../../src/utils/searchEngine.ts'
import { gruposDeSinonimos } from '../../src/utils/sinonimos.ts'
import { lerIndice } from '../assistente/recuperar.ts'

/** Até que posição o artigo certo conta como "achado". */
export const POSICOES = 5

/** Uma consulta real e o artigo que deveria aparecer para ela. */
export const CasoBuscaSchema = z.object({
  id: z.string().min(1),
  /** O que a pessoa digitaria na busca. */
  consulta: z.string().min(1).max(300),
  /** Produto em que a busca é feita: o id ou o nome (ou parte dele). */
  produto: z.string().min(1),
  /** Artigos que respondem: id do artigo ou parte do título. Basta um aparecer. */
  esperados: z.array(z.string().min(1)).min(1),
})
export type CasoBusca = z.infer<typeof CasoBuscaSchema>

const ArquivoSchema = z.object({ casos: z.array(CasoBuscaSchema).min(1) })

/** Lê e valida o arquivo de casos, com mensagens claras se estiver errado. */
export function lerCasosDeBusca(
  bruto: unknown,
): { casos: CasoBusca[] } | { erros: string[] } {
  const r = ArquivoSchema.safeParse(bruto)
  if (!r.success) {
    return {
      erros: r.error.issues.map(
        (i) => `${i.path.join('.') || '(arquivo)'}: ${i.message}`,
      ),
    }
  }
  const repetidos = r.data.casos
    .map((c) => c.id)
    .filter((id, i, todos) => todos.indexOf(id) !== i)
  if (repetidos.length > 0) {
    return { erros: [`ids repetidos: ${[...new Set(repetidos)].join(', ')}`] }
  }
  return { casos: r.data.casos }
}

export interface ResultadoBusca {
  caso: CasoBusca
  /** Posição (1 = primeiro) do primeiro artigo esperado; `null` se não apareceu. */
  posicao: number | null
  /** Os primeiros resultados, para entender o que a busca trouxe no lugar. */
  primeiros: Array<{ id: string; titulo: string; secao?: string }>
  totalDeResultados: number
  /** Nenhum artigo tinha todas as palavras: os resultados vieram por aproximação. */
  aproximado?: boolean
  /** Preenchido quando o caso nem pôde rodar (produto não encontrado, por exemplo). */
  erro?: string
}

const ehEsperado = (item: IndexedItem, esperados: string[]) =>
  esperados.some(
    (e) => item.id === e || normalizar(item.titulo).includes(normalizar(e)),
  )

/** Roda uma consulta no motor do produto e diz onde ficou o artigo esperado. */
export function avaliarCaso(
  motor: SearchEngine,
  productId: string,
  caso: CasoBusca,
): ResultadoBusca {
  const achados = motor.buscar(caso.consulta, { productId })
  const indice = achados.findIndex((h) => ehEsperado(h.item, caso.esperados))
  return {
    caso,
    posicao: indice === -1 ? null : indice + 1,
    primeiros: achados.slice(0, POSICOES).map((h) => ({
      id: h.item.id,
      titulo: h.item.titulo,
      ...(h.secao ? { secao: h.secao.titulo } : {}),
    })),
    totalDeResultados: achados.length,
    ...(achados[0]?.parcial ? { aproximado: true } : {}),
  }
}

export const achou = (r: ResultadoBusca) =>
  r.posicao !== null && r.posicao <= POSICOES

export interface ResumoBusca {
  total: number
  /** Casos com o artigo certo entre os primeiros `POSICOES`. */
  achados: number
  taxa: number
  /** Casos com o artigo certo em primeiro lugar. */
  emPrimeiro: number
  taxaEmPrimeiro: number
  /** Casos em que a busca não trouxe nada. */
  semResultado: number
  /** Casos achados só porque a busca aceitou parte das palavras. */
  achadosPorAproximacao: number
  comErro: number
}

export function resumirBusca(resultados: ResultadoBusca[]): ResumoBusca {
  const total = resultados.length
  const achados = resultados.filter(achou).length
  const emPrimeiro = resultados.filter((r) => r.posicao === 1).length
  return {
    total,
    achados,
    taxa: total ? achados / total : 0,
    emPrimeiro,
    taxaEmPrimeiro: total ? emPrimeiro / total : 0,
    semResultado: resultados.filter((r) => !r.erro && r.totalDeResultados === 0)
      .length,
    achadosPorAproximacao: resultados.filter((r) => achou(r) && r.aproximado)
      .length,
    comErro: resultados.filter((r) => r.erro).length,
  }
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/** Relatório em Markdown: os números e, para cada caso que falhou, o que veio. */
export function relatorioDaBusca(resultados: ResultadoBusca[]): string {
  const r = resumirBusca(resultados)
  const linhas = [
    '# Avaliação da busca',
    '',
    `- Casos: ${r.total}`,
    `- Artigo certo entre os ${POSICOES} primeiros: ${r.achados} (${pct(r.taxa)})`,
    `- Artigo certo em primeiro lugar: ${r.emPrimeiro} (${pct(r.taxaEmPrimeiro)})`,
    `- Buscas sem nenhum resultado: ${r.semResultado}`,
    `- Achados só por aproximação (nenhum artigo tinha todas as palavras): ${r.achadosPorAproximacao}`,
    ...(r.comErro > 0 ? [`- Casos que não puderam rodar: ${r.comErro}`] : []),
    '',
  ]
  const falhas = resultados.filter((x) => !achou(x))
  if (falhas.length === 0) {
    linhas.push('Todos os casos acharam o artigo esperado.', '')
  } else {
    linhas.push('## Casos que não acharam o artigo esperado', '')
    for (const f of falhas) {
      linhas.push(
        `### ${f.caso.id}`,
        '',
        `- Consulta: “${f.caso.consulta}” (produto: ${f.caso.produto})`,
        `- Esperado: ${f.caso.esperados.join(' ou ')}`,
      )
      if (f.erro) linhas.push(`- Erro: ${f.erro}`)
      else if (f.totalDeResultados === 0)
        linhas.push(
          '- A busca não trouxe nada. Se o artigo existe, falta a palavra da consulta nele ou um sinônimo no produto; se não existe, falta o artigo.',
        )
      else {
        linhas.push(
          f.posicao
            ? `- O artigo esperado apareceu só na posição ${f.posicao}.`
            : `- O artigo esperado não apareceu (${f.totalDeResultados} resultados).`,
          '- Vieram primeiro:',
          ...f.primeiros.map(
            (p, i) =>
              `  ${i + 1}. ${p.titulo}${p.secao ? ` (seção: ${p.secao})` : ''}`,
          ),
        )
      }
      linhas.push('')
    }
  }
  const depois = resultados.filter((x) => achou(x) && x.posicao !== 1)
  if (depois.length > 0) {
    linhas.push('## Acharam, mas não em primeiro lugar', '')
    for (const d of depois) {
      linhas.push(
        `- ${d.caso.id}: “${d.caso.consulta}” ficou na posição ${d.posicao} (primeiro veio “${d.primeiros[0]?.titulo ?? ''}”)`,
      )
    }
    linhas.push('')
  }
  return linhas.join('\n')
}

/** Acha o produto pelo id ou pelo nome (inteiro ou parte, sem acento nem caixa). */
export function acharProduto(
  produtos: Block[],
  pedido: string,
): Block | { erro: string } {
  const porId = produtos.find((p) => p.id === pedido)
  if (porId) return porId
  const alvo = normalizar(pedido)
  const exato = produtos.filter((p) => normalizar(p.nome) === alvo)
  const candidatos =
    exato.length > 0
      ? exato
      : produtos.filter((p) => normalizar(p.nome).includes(alvo))
  if (candidatos.length === 1) return candidatos[0]!
  return {
    erro:
      candidatos.length === 0
        ? `produto “${pedido}” não encontrado`
        : `“${pedido}” casa com mais de um produto: ${candidatos.map((p) => p.nome).join(', ')}`,
  }
}

/**
 * Roda os casos contra o índice de busca real (o mesmo que a tela usa, com os
 * sinônimos do produto). Só lê: o índice de cada produto citado e a lista de
 * produtos. Não usa IA e não grava nada.
 */
export async function rodarAvaliacaoDaBusca(
  db: Firestore,
  casos: CasoBusca[],
  opcoes: { verTecnico: boolean },
): Promise<ResultadoBusca[]> {
  const raizes = await db
    .collection('blocks')
    .where('parentId', '==', null)
    .get()
  const produtos = raizes.docs.map((d) => ({ id: d.id, ...d.data() }) as Block)
  const motores = new Map<string, SearchEngine>()
  const resultados: ResultadoBusca[] = []
  for (const caso of casos) {
    const produto = acharProduto(produtos, caso.produto)
    if ('erro' in produto) {
      resultados.push({
        caso,
        posicao: null,
        primeiros: [],
        totalDeResultados: 0,
        erro: produto.erro,
      })
      continue
    }
    let motor = motores.get(produto.id)
    if (!motor) {
      motor = criarMotor(
        await lerIndice(db, [produto.id], opcoes.verTecnico),
        opcoes.verTecnico,
        { sinonimos: gruposDeSinonimos(produto.sinonimos) },
      )
      motores.set(produto.id, motor)
    }
    resultados.push(avaliarCaso(motor, produto.id, caso))
  }
  return resultados
}
