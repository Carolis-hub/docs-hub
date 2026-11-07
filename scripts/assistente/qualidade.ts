import { z } from 'zod'
import type {
  PedidoAssistente,
  RespostaAssistente,
} from '../../src/types/assistente.ts'
import {
  responder,
  type DepsAssistente,
  type GastoDaPergunta,
} from './responder.ts'

const CATEGORIAS = [
  'funcionalidades',
  'configuracoes',
  'processos',
  'regras-de-negocio',
] as const

/** Um caso de teste do assistente: a pergunta e o que se espera da resposta. */
export const CasoSchema = z.object({
  id: z.string().min(1),
  pergunta: z.string().min(3).max(1000),
  filtros: z
    .object({
      unidadeId: z.string().optional(),
      produtoId: z.string().optional(),
      subprodutoId: z.string().optional(),
      categoria: z.enum(CATEGORIAS).optional(),
    })
    .default({}),
  /** `false` para perguntas que a documentação NÃO responde (a IA deve recusar). Padrão: `true`. */
  deveEncontrar: z.boolean().default(true),
  /** Artigos que precisam ser citados: id do artigo ou parte do título. */
  fontesEsperadas: z.array(z.string()).default([]),
  /** Termos que precisam aparecer na resposta (sem diferenciar maiúscula nem acento). */
  termos: z.array(z.string()).default([]),
  /** Termos que NÃO podem aparecer (por exemplo, um valor inventado). */
  termosProibidos: z.array(z.string()).default([]),
})
export type CasoAvaliacao = z.infer<typeof CasoSchema>

export const ArquivoCasosSchema = z.object({
  casos: z.array(CasoSchema).min(1),
})

/** Lê e valida o arquivo de casos; devolve mensagens claras em português se estiver errado. */
export function lerCasos(
  bruto: unknown,
): { casos: CasoAvaliacao[] } | { erros: string[] } {
  const r = ArquivoCasosSchema.safeParse(bruto)
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

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface Verificacao {
  criterio: string
  ok: boolean
  detalhe?: string
}

/** Confere uma resposta contra o que o caso espera. Função pura. */
export function avaliarCaso(
  caso: CasoAvaliacao,
  resposta: RespostaAssistente,
): Verificacao[] {
  const v: Verificacao[] = []
  const texto = normalizar(resposta.resposta)

  v.push({
    criterio: caso.deveEncontrar
      ? 'encontrou a resposta na documentação'
      : 'recusou, como esperado (a documentação não responde)',
    ok: resposta.encontrou === caso.deveEncontrar,
    detalhe:
      resposta.encontrou === caso.deveEncontrar
        ? undefined
        : caso.deveEncontrar
          ? 'respondeu que não encontrou'
          : 'respondeu como se tivesse encontrado',
  })

  // Toda citação [n] no texto precisa apontar para uma fonte devolvida.
  const citadas = [...resposta.resposta.matchAll(/\[(\d+)\]/g)].map((m) =>
    Number(m[1]),
  )
  const numeros = new Set(resposta.fontes.map((f) => f.numero))
  const soltas = citadas.filter((n) => !numeros.has(n))
  v.push({
    criterio: 'as citações apontam para fontes reais',
    ok: soltas.length === 0,
    detalhe: soltas.length
      ? `citações sem fonte: ${[...new Set(soltas)].join(', ')}`
      : undefined,
  })
  if (caso.deveEncontrar && resposta.encontrou) {
    v.push({
      criterio: 'traz pelo menos uma fonte',
      ok: resposta.fontes.length > 0,
    })
  }
  if (!caso.deveEncontrar) {
    v.push({
      criterio: 'não inventa fontes ao recusar',
      ok: resposta.fontes.length === 0,
      detalhe: resposta.fontes.length
        ? `citou ${resposta.fontes.length} fonte(s)`
        : undefined,
    })
  }

  for (const esperada of caso.fontesEsperadas) {
    const alvo = normalizar(esperada)
    const achou = resposta.fontes.some(
      (f) => f.id === esperada || normalizar(f.titulo).includes(alvo),
    )
    v.push({
      criterio: `cita a fonte "${esperada}"`,
      ok: achou,
      detalhe: achou
        ? undefined
        : `citou: ${resposta.fontes.map((f) => f.titulo).join('; ') || 'nenhuma'}`,
    })
  }
  for (const termo of caso.termos) {
    v.push({
      criterio: `menciona "${termo}"`,
      ok: texto.includes(normalizar(termo)),
    })
  }
  for (const termo of caso.termosProibidos) {
    v.push({
      criterio: `não menciona "${termo}"`,
      ok: !texto.includes(normalizar(termo)),
    })
  }
  return v
}

export interface ResultadoCaso {
  caso: CasoAvaliacao
  resposta?: RespostaAssistente
  verificacoes: Verificacao[]
  /** Falha ao perguntar (cota, IA fora do ar…): o caso conta como reprovado. */
  erro?: string
  ms: number
  gasto?: GastoDaPergunta
  passou: boolean
}

/** Roda os casos um a um, sem mexer na cota nem no registro de perguntas reais. */
export async function rodarAvaliacao(
  deps: Omit<DepsAssistente, 'semRegistro' | 'aoConcluir'>,
  uid: string,
  casos: CasoAvaliacao[],
  aoCaso?: (r: ResultadoCaso, indice: number) => void,
): Promise<ResultadoCaso[]> {
  const resultados: ResultadoCaso[] = []
  for (const [i, caso] of casos.entries()) {
    const inicio = Date.now()
    let gasto: GastoDaPergunta | undefined
    let r: ResultadoCaso
    try {
      const pedido: PedidoAssistente = {
        pergunta: caso.pergunta,
        historico: [],
        filtros: caso.filtros,
      }
      const resposta = await responder(
        { ...deps, semRegistro: true, aoConcluir: (g) => (gasto = g) },
        uid,
        pedido,
      )
      const verificacoes = avaliarCaso(caso, resposta)
      r = {
        caso,
        resposta,
        verificacoes,
        ms: Date.now() - inicio,
        gasto,
        passou: verificacoes.every((v) => v.ok),
      }
    } catch (e) {
      r = {
        caso,
        verificacoes: [],
        erro: e instanceof Error ? e.message : String(e),
        ms: Date.now() - inicio,
        gasto,
        passou: false,
      }
    }
    resultados.push(r)
    aoCaso?.(r, i)
  }
  return resultados
}

export interface ResumoAvaliacao {
  total: number
  passaram: number
  taxa: number
  /** Dos casos com fonte esperada: quantas fontes esperadas foram citadas. */
  fontesCitadas: { esperadas: number; citadas: number }
  /** Das perguntas sem resposta na documentação: quantas a IA recusou. */
  recusasCorretas: { total: number; certas: number }
  custoUsd: number
  msMedio: number
}

export function resumir(resultados: ResultadoCaso[]): ResumoAvaliacao {
  const fontes = resultados.flatMap((r) =>
    r.verificacoes.filter((v) => v.criterio.startsWith('cita a fonte')),
  )
  const recusas = resultados.filter((r) => !r.caso.deveEncontrar)
  return {
    total: resultados.length,
    passaram: resultados.filter((r) => r.passou).length,
    taxa: resultados.length
      ? resultados.filter((r) => r.passou).length / resultados.length
      : 0,
    fontesCitadas: {
      // Caso com erro não tem verificações: as fontes esperadas contam como não citadas.
      esperadas: resultados.reduce(
        (t, r) => t + r.caso.fontesEsperadas.length,
        0,
      ),
      citadas: fontes.filter((v) => v.ok).length,
    },
    recusasCorretas: {
      total: recusas.length,
      certas: recusas.filter((r) => r.resposta && !r.resposta.encontrou).length,
    },
    custoUsd: resultados.reduce((t, r) => t + (r.gasto?.custoUsd ?? 0), 0),
    msMedio: resultados.length
      ? Math.round(resultados.reduce((t, r) => t + r.ms, 0) / resultados.length)
      : 0,
  }
}

const pct = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : '—'

export function relatorioDaAvaliacao(resultados: ResultadoCaso[]): string {
  const r = resumir(resultados)
  const linhas = [
    '# Avaliação do assistente',
    '',
    `- Casos aprovados: **${r.passaram} de ${r.total}** (${pct(r.passaram, r.total)})`,
    `- Fontes esperadas que foram citadas: ${r.fontesCitadas.citadas} de ${r.fontesCitadas.esperadas} (${pct(r.fontesCitadas.citadas, r.fontesCitadas.esperadas)})`,
    `- Perguntas sem resposta na documentação recusadas: ${r.recusasCorretas.certas} de ${r.recusasCorretas.total} (${pct(r.recusasCorretas.certas, r.recusasCorretas.total)})`,
    `- Gasto estimado: US$ ${r.custoUsd.toFixed(4)} · tempo médio por pergunta: ${r.msMedio} ms`,
    '',
  ]
  const reprovados = resultados.filter((x) => !x.passou)
  if (reprovados.length) {
    linhas.push(`## Reprovados (${reprovados.length})`, '')
    for (const x of reprovados) {
      linhas.push(`### ${x.caso.id}`, '', `Pergunta: ${x.caso.pergunta}`, '')
      if (x.erro) linhas.push(`- Erro: ${x.erro}`)
      for (const v of x.verificacoes.filter((v) => !v.ok)) {
        linhas.push(`- ${v.criterio}${v.detalhe ? ` — ${v.detalhe}` : ''}`)
      }
      if (x.resposta) linhas.push('', `Resposta: ${x.resposta.resposta}`)
      linhas.push('')
    }
  }
  const aprovados = resultados.filter((x) => x.passou)
  if (aprovados.length) {
    linhas.push(`## Aprovados (${aprovados.length})`, '')
    for (const x of aprovados) linhas.push(`- ${x.caso.id}: ${x.caso.pergunta}`)
    linhas.push('')
  }
  return linhas.join('\n')
}
