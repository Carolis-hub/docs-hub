import type { RegistroAssistente, UsoDiario } from '../types/assistente'

export interface ResumoUso {
  perguntas: number
  custoUsd: number
  tokensEntrada: number
  tokensSaida: number
}

/** Soma só os contadores globais (os por usuário já estão dentro deles). */
export function totalGlobal(uso: UsoDiario[]): ResumoUso {
  const globais = uso.filter((u) => u.tipo === 'global')
  return {
    perguntas: globais.reduce((t, u) => t + (u.perguntas ?? 0), 0),
    custoUsd: globais.reduce((t, u) => t + (u.custoUsd ?? 0), 0),
    tokensEntrada: globais.reduce((t, u) => t + (u.tokensEntrada ?? 0), 0),
    tokensSaida: globais.reduce((t, u) => t + (u.tokensSaida ?? 0), 0),
  }
}

/** Dias com uso, do mais recente para o mais antigo. */
export function porDia(uso: UsoDiario[]): UsoDiario[] {
  return uso
    .filter((u) => u.tipo === 'global')
    .sort((a, b) => b.dia.localeCompare(a.dia))
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export interface PerguntaAgrupada {
  pergunta: string
  vezes: number
  ultimaVez: number
}

/**
 * Perguntas que a documentação não respondeu, agrupadas pelo texto parecido:
 * mostram o que as pessoas procuram e ainda não existe (ou não é achado).
 */
export function semResposta(
  registros: RegistroAssistente[],
): PerguntaAgrupada[] {
  const grupos = new Map<string, PerguntaAgrupada>()
  for (const r of registros) {
    if (r.encontrou) continue
    const chave = normalizar(r.pergunta)
    const g = grupos.get(chave)
    if (g) {
      g.vezes++
      g.ultimaVez = Math.max(g.ultimaVez, r.criadoEm)
    } else {
      grupos.set(chave, {
        pergunta: r.pergunta,
        vezes: 1,
        ultimaVez: r.criadoEm,
      })
    }
  }
  return [...grupos.values()].sort(
    (a, b) => b.vezes - a.vezes || b.ultimaVez - a.ultimaVez,
  )
}

export interface UsoPorUsuario {
  uid: string
  perguntas: number
  custoUsd: number
}

export function porUsuario(registros: RegistroAssistente[]): UsoPorUsuario[] {
  const mapa = new Map<string, UsoPorUsuario>()
  for (const r of registros) {
    const atual = mapa.get(r.uid) ?? { uid: r.uid, perguntas: 0, custoUsd: 0 }
    atual.perguntas++
    atual.custoUsd += r.custoUsd
    mapa.set(r.uid, atual)
  }
  return [...mapa.values()].sort((a, b) => b.custoUsd - a.custoUsd)
}

export interface Qualidade {
  respondidas: number
  encontraram: number
  uteis: number
  ruins: number
}

export function qualidade(registros: RegistroAssistente[]): Qualidade {
  return {
    respondidas: registros.length,
    encontraram: registros.filter((r) => r.encontrou).length,
    uteis: registros.filter((r) => r.feedback === 'util').length,
    ruins: registros.filter((r) => r.feedback === 'ruim').length,
  }
}

export const formatarUsd = (v: number) =>
  `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`
