// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { RespostaAssistente } from '../../src/types/assistente.ts'
import {
  avaliarCaso,
  lerCasos,
  relatorioDaAvaliacao,
  resumir,
  type CasoAvaliacao,
  type ResultadoCaso,
} from './qualidade.ts'

const caso = (extra: Partial<CasoAvaliacao> = {}): CasoAvaliacao => ({
  id: 'c1',
  pergunta: 'Como configuro o envio de e-mail?',
  filtros: {},
  deveEncontrar: true,
  fontesEsperadas: [],
  termos: [],
  termosProibidos: [],
  ...extra,
})

const resposta = (
  extra: Partial<RespostaAssistente> = {},
): RespostaAssistente => ({
  logId: '',
  encontrou: true,
  resposta: 'Abra **Configurações** e ative o envio [1].',
  fontes: [
    {
      numero: 1,
      id: 'a1',
      titulo: 'Configurar o envio de e-mail',
      produto: 'SmartShare',
    },
  ],
  restantesHoje: 30,
  ...extra,
})

const falhas = (c: CasoAvaliacao, r: RespostaAvaliacao) =>
  avaliarCaso(c, r).filter((v) => !v.ok)
type RespostaAvaliacao = RespostaAssistente

describe('lerCasos', () => {
  it('aceita o arquivo e completa os padrões', () => {
    const r = lerCasos({ casos: [{ id: 'a', pergunta: 'Como faço isso?' }] })
    expect(r).toEqual({
      casos: [
        {
          id: 'a',
          pergunta: 'Como faço isso?',
          filtros: {},
          deveEncontrar: true,
          fontesEsperadas: [],
          termos: [],
          termosProibidos: [],
        },
      ],
    })
  })

  it('explica o que está errado', () => {
    expect(lerCasos({ casos: [] })).toMatchObject({ erros: expect.any(Array) })
    const r = lerCasos({ casos: [{ id: 'a', pergunta: 'x' }] })
    expect('erros' in r && r.erros[0]).toContain('casos.0.pergunta')
    expect(
      lerCasos({
        casos: [
          {
            id: 'a',
            pergunta: 'Pergunta válida',
            filtros: { categoria: 'outra' },
          },
        ],
      }),
    ).toHaveProperty('erros')
  })

  it('recusa ids repetidos', () => {
    const r = lerCasos({
      casos: [
        { id: 'a', pergunta: 'Pergunta um?' },
        { id: 'a', pergunta: 'Pergunta dois?' },
      ],
    })
    expect(r).toEqual({ erros: ['ids repetidos: a'] })
  })
})

describe('avaliarCaso', () => {
  it('resposta boa: cita a fonte (por título, sem diferenciar acento ou caixa) e traz os termos', () => {
    const c = caso({
      fontesEsperadas: ['CONFIGURAR O ENVIO'],
      termos: ['configuracoes', 'ativ'],
    })
    expect(falhas(c, resposta())).toEqual([])
  })

  it('a fonte esperada pode ser dada pelo id do artigo', () => {
    expect(falhas(caso({ fontesEsperadas: ['a1'] }), resposta())).toEqual([])
    const v = falhas(caso({ fontesEsperadas: ['zzz'] }), resposta())
    expect(v).toHaveLength(1)
    expect(v[0]!.detalhe).toContain('Configurar o envio de e-mail')
  })

  it('reprova quando deveria achar e a IA disse que não achou', () => {
    const v = falhas(
      caso(),
      resposta({ encontrou: false, fontes: [], resposta: 'Não encontrei.' }),
    )
    expect(v.map((x) => x.criterio)).toContain(
      'encontrou a resposta na documentação',
    )
  })

  it('pergunta sem resposta na documentação: a IA precisa recusar e não inventar fonte', () => {
    const c = caso({ deveEncontrar: false })
    expect(
      falhas(
        c,
        resposta({
          encontrou: false,
          fontes: [],
          resposta: 'Não está na documentação.',
        }),
      ),
    ).toEqual([])
    const v = falhas(c, resposta())
    expect(v.map((x) => x.criterio)).toEqual([
      'recusou, como esperado (a documentação não responde)',
      'não inventa fontes ao recusar',
    ])
  })

  it('citação [n] sem fonte correspondente reprova', () => {
    const v = falhas(
      caso(),
      resposta({ resposta: 'Faça assim [1] e assim [4].' }),
    )
    expect(v).toEqual([
      expect.objectContaining({
        criterio: 'as citações apontam para fontes reais',
        detalhe: 'citações sem fonte: 4',
      }),
    ])
  })

  it('encontrou mas sem nenhuma fonte reprova', () => {
    const v = falhas(caso(), resposta({ fontes: [], resposta: 'Faça assim.' }))
    expect(v.map((x) => x.criterio)).toContain('traz pelo menos uma fonte')
  })

  it('termo faltando ou proibido presente reprova', () => {
    const v = falhas(
      caso({ termos: ['senha'], termosProibidos: ['configurações'] }),
      resposta(),
    )
    expect(v.map((x) => x.criterio)).toEqual([
      'menciona "senha"',
      'não menciona "configurações"',
    ])
  })
})

describe('resumo e relatório', () => {
  const resultado = (
    c: CasoAvaliacao,
    r: RespostaAssistente | undefined,
    extra: Partial<ResultadoCaso> = {},
  ): ResultadoCaso => {
    const verificacoes = r ? avaliarCaso(c, r) : []
    return {
      caso: c,
      resposta: r,
      verificacoes,
      ms: 1000,
      gasto: {
        custoUsd: 0.05,
        tokensEntrada: 100,
        tokensSaida: 10,
        chamadas: 3,
      },
      passou: !!r && verificacoes.every((v) => v.ok),
      ...extra,
    }
  }
  const lista = [
    resultado(caso({ id: 'ok', fontesEsperadas: ['a1'] }), resposta()),
    resultado(
      caso({ id: 'fonte-errada', fontesEsperadas: ['zzz'] }),
      resposta(),
    ),
    resultado(
      caso({ id: 'recusa-certa', deveEncontrar: false }),
      resposta({
        encontrou: false,
        fontes: [],
        resposta: 'Não está na documentação.',
      }),
    ),
    resultado(caso({ id: 'recusa-errada', deveEncontrar: false }), resposta()),
    resultado(caso({ id: 'erro', fontesEsperadas: ['a1'] }), undefined, {
      erro: 'cota estourada',
      gasto: undefined,
    }),
  ]

  it('calcula a taxa, a recuperação das fontes, as recusas, o gasto e o tempo', () => {
    expect(resumir(lista)).toEqual({
      total: 5,
      passaram: 2,
      taxa: 0.4,
      // 3 fontes esperadas (ok, fonte-errada, erro): só "ok" foi citada.
      fontesCitadas: { esperadas: 3, citadas: 1 },
      recusasCorretas: { total: 2, certas: 1 },
      custoUsd: 0.2,
      msMedio: 1000,
    })
  })

  it('o relatório separa reprovados (com o motivo e a resposta) dos aprovados', () => {
    const md = relatorioDaAvaliacao(lista)
    expect(md).toContain('Casos aprovados: **2 de 5** (40%)')
    expect(md).toContain('Fontes esperadas que foram citadas: 1 de 3 (33%)')
    expect(md).toContain('recusadas: 1 de 2 (50%)')
    expect(md).toContain('### fonte-errada')
    expect(md).toContain('cita a fonte "zzz"')
    expect(md).toContain('### erro')
    expect(md).toContain('Erro: cota estourada')
    expect(md).toContain('## Aprovados (2)')
    expect(md).toContain('- ok: Como configuro o envio de e-mail?')
  })

  it('sem casos, não divide por zero', () => {
    expect(resumir([])).toMatchObject({ total: 0, taxa: 0, msMedio: 0 })
  })
})
