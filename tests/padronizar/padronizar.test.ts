import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProvedorIA } from '../../scripts/padronizar/ia'
import {
  gerarProposta,
  lerPadrao,
  padronizar,
  type OpcoesPadronizar,
} from '../../scripts/padronizar/padronizar'
import type { Proposta } from '../../scripts/padronizar/prompt'
import { extrairTextoPlano } from '../../src/utils/content'

const PROJETO = 'demo-docs-hub'
let testEnv: RulesTestEnvironment
const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJETO }))

const IMG = 'https://cdn.test/tarefas.png'
const longo = `Este recurso permite acompanhar as tarefas do seu perfil com prazo de 10 dias, e ${'muito texto corrido '.repeat(40)}`

function conteudo(texto: string, alt = '') {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: texto }] },
      { type: 'image', attrs: { src: IMG, alt } },
    ],
  }
}

function artigo(
  id: string,
  titulo: string,
  doc: object,
  extra: Record<string, unknown> = {},
) {
  const textoPlano = extrairTextoPlano(doc as never)
  return {
    blockId: 'p1',
    productId: 'p1',
    titulo,
    slug: id,
    resumo: textoPlano.slice(0, 50),
    conteudo: doc,
    textoPlano,
    publico: 'usuario',
    status: 'review',
    flags: [],
    views: 0,
    versao: 1,
    autorId: 'a',
    atualizadoPor: 'a',
    criadoEm: 1,
    atualizadoEm: 1,
    revisadoEm: 1,
    ...extra,
  }
}

const PADRAO = lerPadrao('docs/padrao-de-manual.md', '# Padrão\n\nRegras.')

function provedor(
  proposta: Partial<Proposta>,
  chamadas: string[] = [],
): ProvedorIA {
  return {
    modelo: 'modelo-falso',
    async propor({ tituloArtigo, problemas }) {
      chamadas.push(`${tituloArtigo}|${problemas.length}`)
      return {
        precisa_padronizar: true,
        motivo: 'texto corrido sem seções',
        titulo: tituloArtigo,
        conteudo_markdown: `## Para que serve\n\nAcompanhe as tarefas do seu perfil.\n\n## Prazo\n\nO prazo é de 10 dias.\n\n![](${IMG})\n`,
        mudancas: ['Dividido em seções'],
        duvidas: [],
        ...proposta,
      }
    },
  }
}

const base: OpcoesPadronizar = {
  produto: 'p1',
  status: ['review'],
  limite: 10,
  minProblemas: 1,
  usarIA: true,
  gravar: true,
  agora: 1_700_000_000_000,
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await testEnv.clearFirestore()
  const d = db()
  await d.collection('blocks').doc('p1').set({
    nome: 'Produto Teste',
    slug: 'produto-teste',
    parentId: null,
    productId: 'p1',
    ordem: 0,
    descricao: '',
    icone: '',
  })
  const col = d.collection('articles')
  await col.doc('ruim').set(artigo('ruim', 'Tarefas', conteudo(longo)))
  await col
    .doc('boa')
    .set(
      artigo(
        'boa',
        'Painel',
        conteudo('Acompanhe as tarefas.', 'Painel de tarefas'),
      ),
    )
  await col.doc('publicado').set(
    artigo('publicado', 'Publicado', conteudo(longo), {
      status: 'published',
    }),
  )
})

afterAll(async () => {
  await testEnv.clearFirestore()
  await testEnv.cleanup()
})

describe('padronizar (Emulator)', () => {
  it('sem IA só confere: aponta o artigo ruim e não grava nada', async () => {
    const r = await padronizar(db(), PADRAO, null, { ...base, usarIA: false })
    expect(r.total).toBe(2) // só os que estão em revisão
    expect(r.semProblemas).toBe(1)
    expect(r.resultados.map((x) => [x.artigoId, x.status])).toEqual([
      ['ruim', 'conferido'],
    ])
    const sugs = await db()
      .collection('articles')
      .doc('ruim')
      .collection('suggestions')
      .get()
    expect(sugs.empty).toBe(true)
  })

  it('com IA e sem --gravar, só relata', async () => {
    const chamadas: string[] = []
    const r = await padronizar(db(), PADRAO, provedor({}, chamadas), {
      ...base,
      gravar: false,
    })
    expect(r.resultados[0]?.status).toBe('simulada')
    expect(chamadas).toHaveLength(1)
    const sugs = await db()
      .collection('articles')
      .doc('ruim')
      .collection('suggestions')
      .get()
    expect(sugs.empty).toBe(true)
  })

  it('grava a sugestão pendente, sem tocar no artigo, e não repete', async () => {
    const antes = (await db().collection('articles').doc('ruim').get()).data()
    const r = await padronizar(db(), PADRAO, provedor({}), base)
    expect(r.resultados[0]).toMatchObject({
      artigoId: 'ruim',
      status: 'criada',
    })
    const sugs = await db()
      .collection('articles')
      .doc('ruim')
      .collection('suggestions')
      .get()
    expect(sugs.size).toBe(1)
    const s = sugs.docs[0]!.data()
    expect(s).toMatchObject({
      status: 'pending',
      origem: { tipo: 'padronizacao', arquivo: 'docs/padrao-de-manual.md' },
      baseVersao: 1,
      modelo: 'modelo-falso',
    })
    expect(JSON.stringify(s.conteudo)).toContain('Para que serve')
    expect(
      (await db().collection('articles').doc('ruim').get()).data(),
    ).toEqual(antes)

    const de_novo = await padronizar(db(), PADRAO, provedor({}), base)
    expect(de_novo.resultados[0]?.status).toBe('ja-existia')
    expect(
      (
        await db()
          .collection('articles')
          .doc('ruim')
          .collection('suggestions')
          .get()
      ).size,
    ).toBe(1)
  })

  it('padrão novo gera nova sugestão para o mesmo texto', async () => {
    const outro = lerPadrao('docs/padrao-de-manual.md', '# Padrão v2')
    const r = await padronizar(db(), outro, provedor({}), base)
    expect(r.resultados[0]?.status).toBe('criada')
  })

  it('--status published alcança os publicados; --artigo ignora o estado', async () => {
    const a = await padronizar(db(), PADRAO, null, {
      ...base,
      usarIA: false,
      status: ['published'],
    })
    expect(a.resultados.map((x) => x.artigoId)).toEqual(['publicado'])
    const b = await padronizar(db(), PADRAO, null, {
      ...base,
      usarIA: false,
      artigos: ['publicado'],
    })
    expect(b.resultados.map((x) => x.artigoId)).toEqual(['publicado'])
    await expect(
      padronizar(db(), PADRAO, null, { ...base, artigos: ['nao-existe'] }),
    ).rejects.toThrow(/não encontrado/)
  })

  it('produto inexistente lista os produtos', async () => {
    await expect(
      padronizar(db(), PADRAO, null, { ...base, produto: 'xyz' }),
    ).rejects.toThrow(/Produto "xyz" não encontrado/)
  })

  it('a IA que diz estar no padrão não gera sugestão', async () => {
    await testEnv.clearFirestore()
    const d = db()
    await d.collection('blocks').doc('p1').set({
      nome: 'Produto Teste',
      slug: 'produto-teste',
      parentId: null,
      productId: 'p1',
      ordem: 0,
      descricao: '',
      icone: '',
    })
    await d
      .collection('articles')
      .doc('ruim')
      .set(artigo('ruim', 'Tarefas', conteudo(longo)))
    const r = await padronizar(
      db(),
      PADRAO,
      provedor({
        precisa_padronizar: false,
        conteudo_markdown: '',
        motivo: 'já está bom',
      }),
      base,
    )
    expect(r.resultados[0]).toMatchObject({
      status: 'nenhuma-mudanca',
      detalhe: 'já está bom',
    })
  })
})

describe('gerarProposta: avisos para o revisor', () => {
  const artigoBase = { titulo: 'Tarefas', conteudo: conteudo(longo) as never }

  it('avisa quando a imagem muda, quando somem números e quando há [Confirmar]', async () => {
    const r = await gerarProposta(
      artigoBase,
      PADRAO,
      provedor({
        conteudo_markdown:
          '## Passos\n\n1. Clique em **Tarefas** [Confirmar: caminho do menu].\n\n![Outra](https://cdn.test/outra.png)\n',
        duvidas: ['Qual é o menu?'],
      }),
      [],
    )
    expect(r.tipo).toBe('sugestao')
    if (r.tipo !== 'sugestao') return
    const avisos = r.sugestao.avisos.join('\n')
    expect(avisos).toMatch(/imagens mudaram/)
    expect(avisos).toMatch(/números do original.*10/)
    expect(avisos).toMatch(/1 ponto\(s\) a confirmar/)
    expect(avisos).toMatch(/dúvida da IA: Qual é o menu\?/)
  })

  it('sem mudanças reais, não sugere', async () => {
    const md = `${longo}\n\n![](${IMG})\n`
    const r = await gerarProposta(
      artigoBase,
      PADRAO,
      provedor({ conteudo_markdown: md }),
      [],
    )
    expect(r.tipo).toBe('nenhuma')
  })
})
