import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  configDoAmbiente,
  type ConfigAssistente,
} from '../../scripts/assistente/config'
import type { UsoIA } from '../../scripts/assistente/custo'
import { tratarRequisicao } from '../../scripts/assistente/http'
import { ErroIA, type ProvedorAssistente } from '../../scripts/assistente/ia'
import type {
  DocumentoParaResposta,
  RespostaIA,
} from '../../scripts/assistente/prompt'
import {
  ErroAssistente,
  responder,
  diaDe,
} from '../../scripts/assistente/responder'
import type { PedidoAssistente } from '../../src/types/assistente'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

const AGORA = Date.parse('2026-11-10T15:00:00Z')
const DIA = diaDe(AGORA)
const uso = (entrada = 1000, saida = 500): UsoIA => ({
  modelo: 'claude-opus-5-5',
  entrada,
  saida,
  cacheLeitura: 0,
  cacheEscrita: 0,
})

const doc = (t: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
})

function item(
  id: string,
  titulo: string,
  blockId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    titulo,
    resumo: `Resumo de ${titulo}`,
    textoPlano: `${titulo} envio de email configurar`,
    blockId,
    publico: 'usuario',
    ...extra,
  }
}

async function artigo(
  id: string,
  titulo: string,
  productId: string,
  blockId: string,
  extra: Record<string, unknown> = {},
) {
  await db()
    .doc(`articles/${id}`)
    .set({
      titulo,
      productId,
      blockId,
      status: 'published',
      publico: 'usuario',
      conteudo: doc(`Texto de ${titulo}`),
      ...extra,
    })
}

/** IA falsa: guarda o que recebeu e devolve o que o teste mandou. */
function iaFalsa(
  cfg: {
    consultas?: string[]
    ids?: string[]
    resposta?: Partial<RespostaIA>
    erro?: Error
  } = {},
) {
  const chamadas = {
    planejar: [] as Array<{ pergunta: string; historico: unknown[] }>,
    escolher: 0,
    responder: [] as Array<{
      historico: unknown[]
      documentos: DocumentoParaResposta[]
    }>,
  }
  const ia: ProvedorAssistente = {
    async planejar(pergunta, historico) {
      chamadas.planejar.push({ pergunta, historico })
      return {
        consultas: cfg.consultas ?? ['envio de email'],
        uso: uso(200, 50),
      }
    },
    async escolher(_p, candidatos) {
      chamadas.escolher++
      return { ids: cfg.ids ?? candidatos.map((c) => c.id), uso: uso(300, 50) }
    },
    async responder(_p, historico, documentos) {
      chamadas.responder.push({ historico, documentos })
      if (cfg.erro) throw cfg.erro
      return {
        resposta: {
          encontrou: true,
          resposta: 'Abra **Configurações** e ative o envio [1].',
          fontes: [1],
          ...cfg.resposta,
        },
        uso: uso(),
      }
    },
  }
  return { ia, chamadas }
}

const pedido = (extra: Partial<PedidoAssistente> = {}): PedidoAssistente => ({
  pergunta: 'Como configuro o envio de e-mail?',
  historico: [],
  filtros: {},
  ...extra,
})

const cfg = (extra: Partial<ConfigAssistente> = {}): ConfigAssistente => ({
  ...configDoAmbiente({}),
  ...extra,
})

const ids = (docs: DocumentoParaResposta[]) => docs.map((d) => d.titulo).sort()

beforeEach(async () => {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
  const d = db()
  await d.doc('users/admin').set({ role: 'admin', nome: 'Ana' })
  await d
    .doc('users/leitor')
    .set({ role: 'reader', produtosPermitidos: ['p1'], verTecnico: false })
  await d
    .doc('users/tecnico')
    .set({ role: 'reader', produtosPermitidos: ['p1'], verTecnico: true })
  await d
    .doc('users/inativo')
    .set({ role: 'reader', produtosPermitidos: ['p1'], ativo: false })
  await d.doc('blocks/p1').set({
    nome: 'SmartShare 4',
    parentId: null,
    productId: 'p1',
    unidadeId: 'u1',
  })
  await d
    .doc('blocks/p2')
    .set({ nome: 'Outro produto', parentId: null, productId: 'p2' })
  await d
    .doc('blocks/s1')
    .set({ nome: 'Anexos', parentId: 'p1', productId: 'p1' })
  await d
    .doc('blocks/s2')
    .set({ nome: 'Dashboard', parentId: 'p1', productId: 'p1' })
  await artigo('a-pub', 'Configurar o envio de e-mail', 'p1', 's1', {
    categoria: 'configuracoes',
  })
  await artigo('a-dash', 'Dashboard de envios', 'p1', 's2', {
    categoria: 'funcionalidades',
  })
  await artigo('a-tec', 'Envio de e-mail via API', 'p1', 's1', {
    publico: 'tecnico',
  })
  await artigo('a-rasc', 'Rascunho sobre e-mail', 'p1', 's1', {
    status: 'draft',
  })
  await artigo('a-outro', 'E-mail do outro produto', 'p2', 'p2')
  await d.doc('searchIndex/p1').set({
    itens: [
      item('a-pub', 'Configurar o envio de e-mail', 's1', {
        categoria: 'configuracoes',
      }),
      item('a-dash', 'Dashboard de envios', 's2', {
        categoria: 'funcionalidades',
      }),
      item('a-tec', 'Envio de e-mail via API', 's1', { publico: 'tecnico' }),
      // Defesa em profundidade: mesmo que um rascunho vazasse para o índice, não chega à IA.
      item('a-rasc', 'Rascunho sobre e-mail', 's1'),
    ],
  })
  await d
    .doc('searchIndex/p2')
    .set({ itens: [item('a-outro', 'E-mail do outro produto', 'p2')] })
})

const deps = (ia: ProvedorAssistente, c = cfg()) => ({
  db: db(),
  ia,
  config: c,
  agora: () => AGORA,
})

describe('assistente: recuperação e resposta (Emulator)', () => {
  it('responde com base nos artigos publicados e registra uso, custo e log', async () => {
    const { ia, chamadas } = iaFalsa()
    const r = await responder(deps(ia), 'leitor', pedido())

    expect(r.encontrou).toBe(true)
    expect(r.resposta).toContain('[1]')
    expect(r.fontes).toHaveLength(1)
    expect(r.fontes[0]).toMatchObject({ numero: 1, produto: 'SmartShare 4' })
    expect(r.restantesHoje).toBe(29)
    // O texto do artigo chegou à IA como documento numerado.
    expect(chamadas.responder[0]!.documentos[0]).toMatchObject({ numero: 1 })
    expect(chamadas.responder[0]!.documentos[0]!.markdown).toContain('Texto de')

    const g = (await db().doc(`assistenteUso/g_${DIA}`).get()).data()!
    expect(g).toMatchObject({
      tipo: 'global',
      perguntas: 1,
      tokensEntrada: 1200,
      tokensSaida: 550,
    })
    // 3 chamadas ao Opus 5.5 ($4 entrada / $20 saída por milhão).
    expect(g.custoUsd).toBeCloseTo((1200 * 4 + 550 * 20) / 1e6, 8)
    const u = (await db().doc(`assistenteUso/u_leitor_${DIA}`).get()).data()!
    expect(u).toMatchObject({ tipo: 'usuario', uid: 'leitor', perguntas: 1 })

    const log = (await db().doc(`assistenteLog/${r.logId}`).get()).data()!
    expect(log).toMatchObject({
      uid: 'leitor',
      dia: DIA,
      encontrou: true,
      feedback: null,
      pergunta: 'Como configuro o envio de e-mail?',
    })
  })

  it('o leitor só recebe artigo publicado, de produto permitido e público de usuário', async () => {
    // maxFontes 1 força a etapa de escolha; a IA "escolhe" até o que não devia.
    const { ia, chamadas } = iaFalsa({
      ids: ['a-rasc', 'a-outro', 'a-tec', 'a-pub'],
    })
    await responder(deps(ia, cfg({ maxFontes: 4 })), 'leitor', pedido())
    expect(chamadas.escolher).toBe(0)
    expect(ids(chamadas.responder[0]!.documentos)).toEqual([
      'Configurar o envio de e-mail',
      'Dashboard de envios',
    ])
  })

  it('mesmo se a IA escolher ids proibidos, eles não chegam a ela', async () => {
    const { ia, chamadas } = iaFalsa({
      ids: ['a-rasc', 'a-outro', 'a-tec', 'a-pub'],
    })
    await responder(deps(ia, cfg({ maxFontes: 1 })), 'leitor', pedido())
    expect(chamadas.escolher).toBe(1)
    // 'a-rasc' é candidato do índice, mas não é publicado: carregarFontes o barra.
    expect(ids(chamadas.responder[0]?.documentos ?? [])).not.toContain(
      'Rascunho sobre e-mail',
    )
    expect(ids(chamadas.responder[0]?.documentos ?? [])).not.toContain(
      'E-mail do outro produto',
    )
    expect(ids(chamadas.responder[0]?.documentos ?? [])).not.toContain(
      'Envio de e-mail via API',
    )
  })

  it('quem pode ver conteúdo técnico recebe o técnico; ninguém recebe rascunho', async () => {
    const { ia, chamadas } = iaFalsa()
    await responder(deps(ia, cfg({ maxFontes: 6 })), 'tecnico', pedido())
    const titulos = ids(chamadas.responder[0]!.documentos)
    expect(titulos).toContain('Envio de e-mail via API')
    expect(titulos).not.toContain('Rascunho sobre e-mail')
  })

  it('admin lê todos os produtos, mas também só o que está publicado', async () => {
    const { ia, chamadas } = iaFalsa()
    await responder(deps(ia, cfg({ maxFontes: 8 })), 'admin', pedido())
    const titulos = ids(chamadas.responder[0]!.documentos)
    expect(titulos).toContain('E-mail do outro produto')
    expect(titulos).not.toContain('Rascunho sobre e-mail')
  })

  it('filtros: produto, subproduto, categoria e unidade restringem sem ampliar o acesso', async () => {
    const sub = async (filtros: PedidoAssistente['filtros'], uid = 'admin') => {
      const { ia, chamadas } = iaFalsa()
      await responder(deps(ia, cfg({ maxFontes: 8 })), uid, pedido({ filtros }))
      return ids(chamadas.responder[0]?.documentos ?? [])
    }
    expect(await sub({ produtoId: 'p2' })).toEqual(['E-mail do outro produto'])
    expect(await sub({ subprodutoId: 's2' })).toEqual(['Dashboard de envios'])
    expect(await sub({ categoria: 'configuracoes' })).toEqual([
      'Configurar o envio de e-mail',
    ])
    expect(await sub({ unidadeId: 'u1' })).toEqual([
      'Configurar o envio de e-mail',
      'Dashboard de envios',
      'Envio de e-mail via API',
    ])
    // O leitor não ganha acesso ao produto p2 só por filtrar por ele.
    expect(await sub({ produtoId: 'p2' }, 'leitor')).toEqual([])
  })

  it('sem artigo relevante não chama a IA de resposta, e o log marca "não encontrou"', async () => {
    const { ia, chamadas } = iaFalsa({ consultas: ['zzzxxx'] })
    const r = await responder(
      deps(ia),
      'leitor',
      pedido({
        pergunta: 'qqq www',
        filtros: { categoria: 'regras-de-negocio' },
      }),
    )
    expect(r.encontrou).toBe(false)
    expect(r.fontes).toEqual([])
    expect(r.resposta).toContain('Não encontrei')
    expect(chamadas.responder).toHaveLength(0)
    expect(
      (await db().doc(`assistenteLog/${r.logId}`).get()).get('encontrou'),
    ).toBe(false)
  })

  it('filtro que esvazia o escopo responde "não encontrei" sem gastar com a IA', async () => {
    const { ia, chamadas } = iaFalsa()
    const r = await responder(
      deps(ia),
      'leitor',
      pedido({ filtros: { produtoId: 'p2' } }),
    )
    expect(r.encontrou).toBe(false)
    expect(chamadas.planejar).toHaveLength(0)
    const g = (await db().doc(`assistenteUso/g_${DIA}`).get()).data()!
    expect(g.custoUsd ?? 0).toBe(0)
  })

  it('citações inventadas são ignoradas; sem nenhuma válida, mostra os documentos consultados', async () => {
    const { ia } = iaFalsa({
      resposta: { resposta: 'Faça assim [7].', fontes: [7, 0] },
    })
    const r = await responder(deps(ia), 'leitor', pedido())
    expect(r.fontes.length).toBeGreaterThan(0)
    expect(r.fontes.every((f) => f.numero >= 1 && f.numero <= 2)).toBe(true)
  })

  it('só lista como fonte o que a IA citou (no texto ou em "fontes")', async () => {
    const { ia } = iaFalsa({ resposta: { resposta: 'Veja [2].', fontes: [] } })
    const r = await responder(deps(ia), 'leitor', pedido())
    expect(r.fontes.map((f) => f.numero)).toEqual([2])
  })

  it('quando a IA diz que não encontrou, não força fontes', async () => {
    const { ia } = iaFalsa({
      resposta: {
        encontrou: false,
        resposta: 'Não está na documentação.',
        fontes: [],
      },
    })
    const r = await responder(deps(ia), 'leitor', pedido())
    expect(r.encontrou).toBe(false)
    expect(r.fontes).toEqual([])
  })

  it('leva ao máximo as últimas mensagens do histórico, cortando as longas', async () => {
    const { ia, chamadas } = iaFalsa()
    const historico = Array.from({ length: 10 }, (_, i) => ({
      papel: (i % 2 ? 'assistente' : 'usuario') as 'usuario' | 'assistente',
      texto: `mensagem ${i} ${'x'.repeat(2000)}`,
    }))
    await responder(
      deps(ia, cfg({ maxHistorico: 4 })),
      'leitor',
      pedido({ historico }),
    )
    const recebido = chamadas.planejar[0]!.historico as Array<{ texto: string }>
    expect(recebido).toHaveLength(4)
    expect(recebido[0]!.texto.startsWith('mensagem 6')).toBe(true)
    expect(recebido[0]!.texto.length).toBe(1000)
  })
})

describe('assistente: acesso, cota e orçamento (Emulator)', () => {
  it('conta sem perfil ou desativada não usa o assistente nem a cota', async () => {
    const { ia, chamadas } = iaFalsa()
    for (const uid of ['inativo', 'nao-existe']) {
      await expect(responder(deps(ia), uid, pedido())).rejects.toMatchObject({
        codigo: 'sem-perfil',
        status: 403,
      })
    }
    expect(chamadas.planejar).toHaveLength(0)
    expect((await db().collection('assistenteUso').get()).size).toBe(0)
  })

  it('para na cota diária do usuário, sem afetar os outros', async () => {
    const { ia } = iaFalsa()
    const c = cfg({ perguntasPorUsuarioDia: 2 })
    await responder(deps(ia, c), 'leitor', pedido())
    const segunda = await responder(deps(ia, c), 'leitor', pedido())
    expect(segunda.restantesHoje).toBe(0)
    await expect(
      responder(deps(ia, c), 'leitor', pedido()),
    ).rejects.toMatchObject({
      codigo: 'cota-usuario',
      status: 429,
    })
    await expect(
      responder(deps(ia, c), 'tecnico', pedido()),
    ).resolves.toBeDefined()
  })

  it('a cota é por dia: no dia seguinte volta a zero', async () => {
    const { ia } = iaFalsa()
    const c = cfg({ perguntasPorUsuarioDia: 1 })
    await responder(deps(ia, c), 'leitor', pedido())
    await expect(
      responder(deps(ia, c), 'leitor', pedido()),
    ).rejects.toBeInstanceOf(ErroAssistente)
    const amanha = { ...deps(ia, c), agora: () => AGORA + 24 * 3600 * 1000 }
    await expect(responder(amanha, 'leitor', pedido())).resolves.toBeDefined()
  })

  it('para no teto de gasto do dia, para todos', async () => {
    await db()
      .doc(`assistenteUso/g_${DIA}`)
      .set({ tipo: 'global', dia: DIA, custoUsd: 10.5, perguntas: 400 })
    const { ia, chamadas } = iaFalsa()
    await expect(
      responder(deps(ia, cfg({ orcamentoDiarioUsd: 10 })), 'leitor', pedido()),
    ).rejects.toMatchObject({
      codigo: 'orcamento',
      status: 429,
    })
    expect(chamadas.planejar).toHaveLength(0)
  })

  it('se a IA falha, a pergunta volta para a cota e o gasto parcial fica registrado', async () => {
    const { ia } = iaFalsa({ erro: new ErroIA('IA fora do ar') })
    await expect(responder(deps(ia), 'leitor', pedido())).rejects.toMatchObject(
      {
        codigo: 'ia-indisponivel',
        status: 502,
        message: 'IA fora do ar',
      },
    )
    const u = (await db().doc(`assistenteUso/u_leitor_${DIA}`).get()).data()!
    expect(u.perguntas).toBe(0)
    expect(u.custoUsd).toBeGreaterThan(0)
    expect((await db().collection('assistenteLog').get()).size).toBe(0)
  })
})

describe('assistente: camada HTTP (Emulator)', () => {
  const base = (ia: ProvedorAssistente) => ({
    ...deps(ia),
    verificarToken: async (t: string) => {
      if (t === 'token-leitor') return 'leitor'
      throw new Error('inválido')
    },
  })
  const corpo = {
    pergunta: 'Como configuro o envio?',
    historico: [],
    filtros: {},
  }

  it('exige POST, token válido e corpo válido', async () => {
    const { ia } = iaFalsa()
    const d = base(ia)
    expect((await tratarRequisicao(d, { metodo: 'GET', corpo })).status).toBe(
      405,
    )
    expect((await tratarRequisicao(d, { metodo: 'POST', corpo })).status).toBe(
      401,
    )
    const semToken = await tratarRequisicao(d, {
      metodo: 'POST',
      authorization: 'Bearer ruim',
      corpo,
    })
    expect(semToken).toMatchObject({
      status: 401,
      corpo: { erro: { codigo: 'nao-autenticado' } },
    })
    for (const ruim of [
      {},
      { pergunta: 'ab' },
      { pergunta: 'x'.repeat(1001) },
      { pergunta: 'ok ok', filtros: { categoria: 'outra' } },
    ]) {
      const r = await tratarRequisicao(d, {
        metodo: 'POST',
        authorization: 'Bearer token-leitor',
        corpo: ruim,
      })
      expect(r.status).toBe(400)
    }
  })

  it('responde 200 com a resposta e as fontes', async () => {
    const { ia } = iaFalsa()
    const r = await tratarRequisicao(base(ia), {
      metodo: 'POST',
      authorization: 'Bearer token-leitor',
      corpo,
    })
    expect(r.status).toBe(200)
    expect(r.corpo).toMatchObject({ encontrou: true, restantesHoje: 29 })
  })

  it('erro de cota vira 429 com código; erro inesperado vira 500 sem vazar detalhes', async () => {
    const { ia } = iaFalsa()
    const d = base(ia)
    const cota = await tratarRequisicao(
      { ...d, config: cfg({ perguntasPorUsuarioDia: 1 }) },
      { metodo: 'POST', authorization: 'Bearer token-leitor', corpo },
    )
    expect(cota.status).toBe(200)
    const segunda = await tratarRequisicao(
      { ...d, config: cfg({ perguntasPorUsuarioDia: 1 }) },
      { metodo: 'POST', authorization: 'Bearer token-leitor', corpo },
    )
    expect(segunda).toMatchObject({
      status: 429,
      corpo: { erro: { codigo: 'cota-usuario' } },
    })

    const quebrada = iaFalsa({
      erro: new Error('segredo interno: chave sk-ant-123'),
    })
    const r = await tratarRequisicao(base(quebrada.ia), {
      metodo: 'POST',
      authorization: 'Bearer token-leitor',
      corpo,
    })
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.corpo)).not.toContain('sk-ant')
  })
})
