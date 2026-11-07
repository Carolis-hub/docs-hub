import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import { configDoAmbiente } from '../../scripts/assistente/config'
import type { UsoIA } from '../../scripts/assistente/custo'
import type { ProvedorAssistente } from '../../scripts/assistente/ia'
import {
  lerCasos,
  resumir,
  rodarAvaliacao,
} from '../../scripts/assistente/qualidade'
import { responder } from '../../scripts/assistente/responder'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))
const uso: UsoIA = {
  modelo: 'claude-opus-5-5',
  entrada: 1000,
  saida: 500,
  cacheLeitura: 0,
  cacheEscrita: 0,
}
const doc = (t: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
})

/** IA falsa que "responde" citando o primeiro documento recebido. */
const ia: ProvedorAssistente = {
  async planejar() {
    return { consultas: ['envio de email'], uso }
  },
  async escolher(_p, candidatos) {
    return { ids: candidatos.map((c) => c.id), uso }
  },
  async responder(pergunta, _h, documentos) {
    if (pergunta.includes('impossivel')) {
      return {
        resposta: {
          encontrou: false,
          resposta: 'Não está na documentação.',
          fontes: [],
        },
        uso,
      }
    }
    return {
      resposta: {
        encontrou: true,
        resposta: `Veja ${documentos[0]!.titulo} [1].`,
        fontes: [1],
      },
      uso,
    }
  },
}

beforeEach(async () => {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
  const d = db()
  await d
    .doc('users/leitor')
    .set({ role: 'reader', produtosPermitidos: ['p1'] })
  await d
    .doc('blocks/p1')
    .set({ nome: 'SmartShare', parentId: null, productId: 'p1' })
  await d.doc('articles/a1').set({
    titulo: 'Configurar o envio de e-mail',
    productId: 'p1',
    blockId: 'p1',
    status: 'published',
    publico: 'usuario',
    conteudo: doc('Texto do artigo'),
  })
  await d.doc('searchIndex/p1').set({
    itens: [
      {
        id: 'a1',
        titulo: 'Configurar o envio de e-mail',
        resumo: 'Como configurar',
        textoPlano: 'configurar envio de email',
        blockId: 'p1',
        publico: 'usuario',
      },
    ],
  })
})

const deps = () => ({ db: db(), ia, config: configDoAmbiente({}) })

describe('avaliação de qualidade do assistente (Emulator)', () => {
  it('roda os casos, confere as respostas e soma o gasto, sem deixar rastro nos números de uso', async () => {
    const lido = lerCasos({
      casos: [
        {
          id: 'acha',
          pergunta: 'Como configuro o envio de e-mail?',
          fontesEsperadas: ['configurar o envio'],
          termos: ['veja'],
        },
        {
          id: 'recusa',
          pergunta: 'Pergunta impossivel de responder aqui',
          deveEncontrar: false,
        },
        {
          id: 'falha-de-proposito',
          pergunta: 'Como configuro o envio de e-mail?',
          termos: ['palavra que não aparece'],
        },
      ],
    })
    if (!('casos' in lido)) throw new Error('casos inválidos')

    const vistos: string[] = []
    const resultados = await rodarAvaliacao(deps(), 'leitor', lido.casos, (r) =>
      vistos.push(r.caso.id),
    )
    expect(vistos).toEqual(['acha', 'recusa', 'falha-de-proposito'])
    expect(resultados.map((r) => r.passou)).toEqual([true, true, false])

    // A recusa certa conta como aprovada: a IA disse que não achou e não inventou fonte.
    expect(resultados[1]!.resposta).toMatchObject({
      encontrou: false,
      fontes: [],
    })
    // O terceiro falha de propósito: o termo pedido não está na resposta.
    expect(
      resultados[2]!.verificacoes.filter((v) => !v.ok).map((v) => v.criterio),
    ).toEqual(['menciona "palavra que não aparece"'])

    const resumo = resumir(resultados)
    expect(resumo).toMatchObject({ total: 3, passaram: 2 })
    expect(resumo.recusasCorretas).toEqual({ total: 1, certas: 1 })
    expect(resumo.custoUsd).toBeGreaterThan(0)
    // Com poucos candidatos a etapa de escolha é pulada: só reformular e responder.
    expect(resultados[0]!.gasto).toMatchObject({ chamadas: 2 })

    // Nada foi gravado: nem cota, nem contador de uso, nem registro de pergunta.
    expect((await db().collection('assistenteUso').get()).size).toBe(0)
    expect((await db().collection('assistenteLog').get()).size).toBe(0)
  })

  it('a avaliação respeita o acesso de quem "pergunta": produto fora do perfil não é achado', async () => {
    const lido = lerCasos({
      casos: [
        {
          id: 'outro-produto',
          pergunta: 'Como configuro o envio de e-mail?',
          filtros: { produtoId: 'p2' },
        },
      ],
    })
    if (!('casos' in lido)) throw new Error('casos inválidos')
    const [r] = await rodarAvaliacao(deps(), 'leitor', lido.casos)
    expect(r!.resposta?.encontrou).toBe(false)
    expect(r!.passou).toBe(false)
  })

  it('erro ao perguntar (conta sem perfil) vira caso reprovado com a mensagem, e a rodada continua', async () => {
    const lido = lerCasos({
      casos: [
        { id: 'a', pergunta: 'Primeira pergunta?' },
        { id: 'b', pergunta: 'Segunda pergunta?' },
      ],
    })
    if (!('casos' in lido)) throw new Error('casos inválidos')
    const resultados = await rodarAvaliacao(deps(), 'sem-perfil', lido.casos)
    expect(resultados).toHaveLength(2)
    expect(
      resultados.every((r) => !r.passou && r.erro?.includes('não tem acesso')),
    ).toBe(true)
  })

  it('o modo sem registro devolve o mesmo que o normal, só sem logId e sem consumir a cota', async () => {
    const pedido = {
      pergunta: 'Como configuro o envio de e-mail?',
      historico: [],
      filtros: {},
    }
    const sem = await responder(
      { ...deps(), semRegistro: true },
      'leitor',
      pedido,
    )
    expect(sem.logId).toBe('')
    expect(sem.restantesHoje).toBe(30)
    expect((await db().collection('assistenteUso').get()).size).toBe(0)

    const com = await responder(deps(), 'leitor', pedido)
    expect(com.logId).not.toBe('')
    expect(com.restantesHoje).toBe(29)
    expect(com.resposta).toBe(sem.resposta)
  })
})
