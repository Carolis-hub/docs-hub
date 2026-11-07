import { describe, expect, it } from 'vitest'
import type { RegistroAssistente, UsoDiario } from '../types/assistente'
import {
  formatarUsd,
  porDia,
  porUsuario,
  qualidade,
  semResposta,
  totalGlobal,
} from './assistenteUso'

const uso = (extra: Partial<UsoDiario>): UsoDiario => ({
  id: 'x',
  tipo: 'global',
  dia: '2026-11-01',
  perguntas: 0,
  custoUsd: 0,
  tokensEntrada: 0,
  tokensSaida: 0,
  ...extra,
})
const log = (extra: Partial<RegistroAssistente>): RegistroAssistente => ({
  id: 'l',
  uid: 'u1',
  dia: '2026-11-01',
  criadoEm: 1,
  pergunta: 'Como faço?',
  encontrou: true,
  fontes: [],
  filtros: {},
  modelo: 'm',
  tokensEntrada: 0,
  tokensSaida: 0,
  custoUsd: 0.01,
  ms: 1,
  feedback: null,
  ...extra,
})

describe('uso do assistente', () => {
  it('soma só os contadores globais e ordena os dias do mais novo ao mais antigo', () => {
    const lista = [
      uso({
        dia: '2026-11-01',
        perguntas: 3,
        custoUsd: 0.5,
        tokensEntrada: 100,
        tokensSaida: 10,
      }),
      uso({ dia: '2026-11-02', perguntas: 2, custoUsd: 0.25 }),
      uso({ tipo: 'usuario', uid: 'u1', perguntas: 99, custoUsd: 99 }),
    ]
    expect(totalGlobal(lista)).toEqual({
      perguntas: 5,
      custoUsd: 0.75,
      tokensEntrada: 100,
      tokensSaida: 10,
    })
    expect(porDia(lista).map((u) => u.dia)).toEqual([
      '2026-11-02',
      '2026-11-01',
    ])
  })

  it('agrupa as perguntas sem resposta por texto parecido, as mais frequentes primeiro', () => {
    const r = semResposta([
      log({ pergunta: 'Como exportar PDF?', encontrou: false, criadoEm: 1 }),
      log({ pergunta: 'como exportar  pdf?', encontrou: false, criadoEm: 5 }),
      log({ pergunta: 'Outra coisa', encontrou: false, criadoEm: 9 }),
      log({ pergunta: 'Respondida', encontrou: true }),
    ])
    expect(r.map((g) => [g.pergunta, g.vezes, g.ultimaVez])).toEqual([
      ['Como exportar PDF?', 2, 5],
      ['Outra coisa', 1, 9],
    ])
  })

  it('soma por usuário (o mais caro primeiro) e resume a qualidade', () => {
    const regs = [
      log({ uid: 'a', custoUsd: 0.1, feedback: 'util' }),
      log({ uid: 'b', custoUsd: 0.5, feedback: 'ruim', encontrou: false }),
      log({ uid: 'b', custoUsd: 0.25 }),
    ]
    expect(porUsuario(regs)).toEqual([
      { uid: 'b', perguntas: 2, custoUsd: 0.75 },
      { uid: 'a', perguntas: 1, custoUsd: 0.1 },
    ])
    expect(qualidade(regs)).toEqual({
      respondidas: 3,
      encontraram: 2,
      uteis: 1,
      ruins: 1,
    })
  })

  it('formata dólares com mais casas quando o valor é pequeno', () => {
    expect(formatarUsd(12.5)).toBe('US$ 12,50')
    expect(formatarUsd(0.0123)).toBe('US$ 0,0123')
  })
})
