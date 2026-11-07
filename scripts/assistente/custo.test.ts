// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { configDoAmbiente } from './config.ts'
import { custoEstimado, somar } from './custo.ts'

describe('custoEstimado', () => {
  it('usa o preço por milhão de tokens do modelo', () => {
    const c = custoEstimado({
      modelo: 'claude-opus-5-5',
      entrada: 1_000_000,
      saida: 100_000,
      cacheLeitura: 0,
      cacheEscrita: 0,
    })
    expect(c).toBeCloseTo(4 + 2, 6)
  })

  it('cache: leitura a 10% e escrita a 125% do preço de entrada', () => {
    const c = custoEstimado({
      modelo: 'claude-opus-5-5',
      entrada: 0,
      saida: 0,
      cacheLeitura: 1_000_000,
      cacheEscrita: 1_000_000,
    })
    expect(c).toBeCloseTo(0.4 + 5, 6)
  })

  it('modelo desconhecido custa como o mais caro, para o teto errar a favor da segurança', () => {
    const c = custoEstimado({
      modelo: 'novo-modelo',
      entrada: 1_000_000,
      saida: 0,
      cacheLeitura: 0,
      cacheEscrita: 0,
    })
    expect(c).toBe(10)
  })

  it('soma várias chamadas, contando os tokens de cache como entrada', () => {
    const t = somar([
      {
        modelo: 'claude-haiku-5-5',
        entrada: 100,
        saida: 10,
        cacheLeitura: 50,
        cacheEscrita: 0,
      },
      {
        modelo: 'claude-opus-5-5',
        entrada: 200,
        saida: 20,
        cacheLeitura: 0,
        cacheEscrita: 5,
      },
    ])
    expect(t.entrada).toBe(355)
    expect(t.saida).toBe(30)
    expect(t.custoUsd).toBeGreaterThan(0)
  })
})

describe('configDoAmbiente', () => {
  it('tem padrões seguros e aceita troca por variável de ambiente', () => {
    const padrao = configDoAmbiente({})
    expect(padrao).toMatchObject({
      modelo: 'claude-opus-5-5',
      modeloBusca: 'claude-opus-5-5',
      perguntasPorUsuarioDia: 30,
      orcamentoDiarioUsd: 10,
    })
    const c = configDoAmbiente({
      ASSISTENTE_MODELO_BUSCA: 'claude-haiku-5-5',
      ASSISTENTE_PERGUNTAS_POR_DIA: '5',
      ASSISTENTE_ORCAMENTO_DIARIO_USD: 'abc',
    })
    expect(c.modeloBusca).toBe('claude-haiku-5-5')
    expect(c.modelo).toBe('claude-opus-5-5')
    expect(c.perguntasPorUsuarioDia).toBe(5)
    expect(c.orcamentoDiarioUsd).toBe(10)
  })
})
