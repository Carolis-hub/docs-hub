import { describe, expect, it } from 'vitest'
import type { Sincronizacao } from '../types/sincronizacao'
import { haQuantoTempo, ordenarFontes, situacaoDaFonte } from './sincronizacao'

const DIA = 24 * 3600 * 1000
const AGORA = Date.parse('2026-11-10T12:00:00Z')

const fonte = (extra: Partial<Sincronizacao> = {}): Sincronizacao => ({
  fonteId: 'f',
  produtoId: 'p',
  produtoNome: 'Produto',
  ultimaExecucao: AGORA - 1000,
  modo: 'manual',
  repo: null,
  commit: null,
  duracaoMs: 10,
  resumo: {
    novo: 0,
    alterado: 0,
    'sem-alteracao': 5,
    reapareceu: 0,
    duplicado: 0,
    removido: 0,
    erro: 0,
    ignorado: 0,
  },
  erros: [],
  removidos: [],
  ...extra,
})

describe('situacaoDaFonte', () => {
  it('em dia quando conferida há pouco e sem erros', () => {
    expect(situacaoDaFonte(fonte(), AGORA)).toBe('em-dia')
    expect(
      situacaoDaFonte(fonte({ ultimaExecucao: AGORA - 6 * DIA }), AGORA),
    ).toBe('em-dia')
  })

  it('desatualizada depois de 7 dias sem conferir', () => {
    expect(
      situacaoDaFonte(fonte({ ultimaExecucao: AGORA - 8 * DIA }), AGORA),
    ).toBe('desatualizada')
  })

  it('erros pesam mais que o atraso', () => {
    const comErro = fonte({
      ultimaExecucao: AGORA - 30 * DIA,
      erros: [{ caminho: 'a.md', detalhe: 'x' }],
    })
    expect(situacaoDaFonte(comErro, AGORA)).toBe('com-erros')
    const soContagem = fonte()
    soContagem.resumo.erro = 2
    expect(situacaoDaFonte(soContagem, AGORA)).toBe('com-erros')
  })
})

describe('haQuantoTempo', () => {
  it('escolhe a unidade pelo tamanho do intervalo', () => {
    expect(haQuantoTempo(AGORA - 5_000, AGORA)).toBe('agora há pouco')
    expect(haQuantoTempo(AGORA - 5 * 60_000, AGORA)).toBe('há 5 min')
    expect(haQuantoTempo(AGORA - 3 * 3600_000, AGORA)).toBe('há 3 h')
    expect(haQuantoTempo(AGORA - 5 * DIA, AGORA)).toBe('há 5 dias')
  })
})

describe('ordenarFontes', () => {
  it('erros primeiro, depois desatualizadas, depois as mais recentes', () => {
    const lista = [
      fonte({ fonteId: 'velha-em-dia', ultimaExecucao: AGORA - 2 * DIA }),
      fonte({ fonteId: 'recente', ultimaExecucao: AGORA - 1000 }),
      fonte({ fonteId: 'parada', ultimaExecucao: AGORA - 9 * DIA }),
      fonte({ fonteId: 'erro', erros: [{ caminho: 'a', detalhe: 'b' }] }),
    ]
    expect(ordenarFontes(lista, AGORA).map((f) => f.fonteId)).toEqual([
      'erro',
      'parada',
      'recente',
      'velha-em-dia',
    ])
  })
})
