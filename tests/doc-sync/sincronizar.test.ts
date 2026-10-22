import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProvedorIA } from '../../scripts/doc-sync/ia'
import type { Proposta } from '../../scripts/doc-sync/prompt'
import { lerRegras } from '../../scripts/doc-sync/regras'
import {
  idDaSugestao,
  sincronizarRegras,
} from '../../scripts/doc-sync/sincronizar'
import { extrairTextoPlano } from '../../src/utils/content'
import { itemDoArtigo } from '../../src/utils/searchIndex'

const PROJETO = 'demo-docs-hub'
let testEnv: RulesTestEnvironment
const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: PROJETO }))

const conteudo = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Anexos' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Os anexos aceitam até 5 MB.' }],
    },
    {
      type: 'image',
      attrs: { src: 'https://cdn.test/anexos.png', alt: 'Tela de anexos' },
    },
  ],
}

function artigo(id: string, titulo: string, status = 'published') {
  const textoPlano = extrairTextoPlano(conteudo)
  return {
    blockId: 'p1',
    productId: 'p1',
    titulo,
    slug: id,
    resumo: textoPlano,
    conteudo,
    textoPlano,
    publico: 'usuario',
    status,
    flags: [],
    views: 0,
    versao: 1,
    autorId: 'a',
    atualizadoPor: 'a',
    criadoEm: 1,
    atualizadoEm: 1,
    revisadoEm: 1,
  }
}

function provedor(
  proposta: Partial<Proposta>,
  chamadas: string[] = [],
): ProvedorIA {
  return {
    modelo: 'modelo-falso',
    async propor({ tituloArtigo, markdownAtual }) {
      chamadas.push(`${tituloArtigo}\n${markdownAtual}`)
      return {
        precisa_atualizar: true,
        motivo: 'o limite mudou',
        titulo: tituloArtigo,
        conteudo_markdown:
          '## Anexos\n\nOs anexos aceitam até 10 MB.\n\n![Tela de anexos](https://cdn.test/anexos.png)\n',
        mudancas: ['Limite de anexo de 5 MB para 10 MB'],
        prints_desatualizados: false,
        ...proposta,
      }
    },
  }
}

const REGRAS = lerRegras(
  'regras/anexos.md',
  '---\nprodutos: x\nartigos: a1\n---\n# Anexos\n\nO limite de anexo é de 10 MB.\n',
)
const base = { gravar: true, agora: 1_700_000_000_000 }

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await testEnv.clearFirestore()
  const d = db()
  await d
    .collection('articles')
    .doc('a1')
    .set(artigo('a1', 'Anexos em atividades'))
  await d.collection('articles').doc('a2').set(artigo('a2', 'Outro artigo'))
  await d
    .collection('searchIndex')
    .doc('p1')
    .set({
      itens: [
        itemDoArtigo({
          ...(artigo('a1', 'Anexos em atividades') as never),
          id: 'a1',
        }),
        itemDoArtigo({
          ...(artigo('a2', 'Fluxo de aprovação') as never),
          id: 'a2',
          textoPlano: 'Aprove documentos.',
          resumo: '',
        }),
      ],
    })
})

afterAll(async () => {
  await testEnv.clearFirestore()
  await testEnv.cleanup()
})

describe('doc-sync (Emulator)', () => {
  it('grava a sugestão pendente, sem publicar nada', async () => {
    const chamadas: string[] = []
    const r = await sincronizarRegras(
      db(),
      REGRAS,
      provedor({}, chamadas),
      base,
    )
    expect(r.resultados).toEqual([
      { artigoId: 'a1', automatico: false, status: 'criada' },
    ])
    expect(chamadas[0]).toContain('Os anexos aceitam até 5 MB.')

    const sid = idDaSugestao(REGRAS.arquivo, REGRAS.hash)
    const sug = (
      await db().collection('articles/a1/suggestions').doc(sid).get()
    ).data()
    expect(sug).toMatchObject({
      status: 'pending',
      automatico: false,
      diffResumo: ['Limite de anexo de 5 MB para 10 MB'],
      origem: { tipo: 'regras-md', arquivo: 'regras/anexos.md' },
      baseVersao: 1,
      avisos: [],
      modelo: 'modelo-falso',
    })
    expect(sug?.textoPlano).toContain('10 MB')

    // O artigo publicado continua intacto.
    const a1 = (await db().collection('articles').doc('a1').get()).data()
    expect(a1).toMatchObject({ status: 'published', versao: 1 })
    expect(a1?.textoPlano).toContain('5 MB')
    expect(
      (
        await db()
          .collection('auditLog')
          .where('acao', '==', 'sugestao.criar')
          .get()
      ).size,
    ).toBe(1)
  })

  it('é idempotente: as mesmas regras não geram outra sugestão nem chamam a IA', async () => {
    const chamadas: string[] = []
    const r = await sincronizarRegras(
      db(),
      REGRAS,
      provedor({}, chamadas),
      base,
    )
    expect(r.resultados[0]?.status).toBe('ja-existia')
    expect(chamadas).toHaveLength(0)
    expect((await db().collection('articles/a1/suggestions').get()).size).toBe(
      1,
    )
  })

  it('regras novas (outro conteúdo) geram nova sugestão', async () => {
    const novas = lerRegras(
      'regras/anexos.md',
      REGRAS.corpo + '\nTipos: PDF e PNG.\n',
    )
    const r = await sincronizarRegras(
      db(),
      { ...novas, artigos: ['a1'] },
      provedor({}),
      base,
    )
    expect(r.resultados[0]?.status).toBe('criada')
    expect((await db().collection('articles/a1/suggestions').get()).size).toBe(
      2,
    )
  })

  it('marca prints_desatualizados no artigo e avisa se uma imagem sumiu', async () => {
    const regras = lerRegras(
      'regras/outra.md',
      '---\nartigos: a2\n---\n# Fluxo\n\nA tela mudou.\n',
    )
    const r = await sincronizarRegras(
      db(),
      regras,
      provedor({
        prints_desatualizados: true,
        conteudo_markdown: '## Anexos\n\nTexto novo.\n',
      }),
      base,
    )
    expect(r.resultados[0]?.status).toBe('criada')
    expect(
      (await db().collection('articles').doc('a2').get()).data()?.flags,
    ).toEqual(['prints_desatualizados'])
    const sid = idDaSugestao(regras.arquivo, regras.hash)
    const sug = (
      await db().collection('articles/a2/suggestions').doc(sid).get()
    ).data()
    expect(sug?.pratsDesatualizados).toBe(true)
    expect(sug?.avisos).toEqual([
      expect.stringContaining('imagem foi removida'),
    ])
  })

  it('não grava quando a IA diz que não há o que mudar', async () => {
    const regras = lerRegras(
      'regras/nada.md',
      '---\nartigos: a1\n---\n# Nada\n\nSem mudança.\n',
    )
    const r = await sincronizarRegras(
      db(),
      regras,
      provedor({
        precisa_atualizar: false,
        motivo: 'já reflete as regras',
        conteudo_markdown: '',
      }),
      base,
    )
    expect(r.resultados[0]).toMatchObject({
      status: 'nenhuma-mudanca',
      detalhe: 'já reflete as regras',
    })
  })

  it('em simulação a IA roda mas nada é gravado', async () => {
    const regras = lerRegras(
      'regras/sim.md',
      '---\nartigos: a1\n---\n# Simulação\n\nOutra regra.\n',
    )
    const r = await sincronizarRegras(db(), regras, provedor({}), {
      ...base,
      gravar: false,
    })
    expect(r.resultados[0]?.status).toBe('simulada')
    expect((await db().collection('articles/a1/suggestions').get()).size).toBe(
      2,
    )
  })

  it('busca artigos parecidos quando o arquivo não indica nenhum', async () => {
    const regras = lerRegras(
      'regras/auto.md',
      '---\nproduto: p1\n---\n# Anexos em atividades\n\n## Limite\n\nO limite de anexo mudou.\n',
    )
    const r = await sincronizarRegras(db(), regras, provedor({}), {
      ...base,
      gravar: false,
    })
    expect(r.resultados.map((x) => [x.artigoId, x.automatico])).toContainEqual([
      'a1',
      true,
    ])
  })

  it('avisa quando não acha nenhum artigo', async () => {
    const regras = lerRegras(
      'regras/vazio.md',
      '---\nproduto: p1\n---\n# Quântica\n\nTeletransporte.\n',
    )
    const r = await sincronizarRegras(db(), regras, provedor({}), base)
    expect(r.resultados).toEqual([])
    expect(r.semArtigo).toMatch(/nenhum artigo/)
  })

  it('relata artigo inexistente e erro da IA sem derrubar os demais', async () => {
    const regras = lerRegras(
      'regras/erros.md',
      '---\nartigos: nao-existe, a2\n---\n# E\n\nTexto novo.\n',
    )
    const falho: ProvedorIA = {
      modelo: 'x',
      propor: async () => {
        throw new Error('a IA recusou o pedido')
      },
    }
    const r = await sincronizarRegras(db(), regras, falho, base)
    expect(r.resultados.map((x) => x.status)).toEqual([
      'artigo-nao-encontrado',
      'erro',
    ])
  })

  it('só admin lê as sugestões (regras de segurança)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc } = await import('firebase/firestore')
      await setDoc(doc(ctx.firestore(), 'users/admin'), {
        role: 'admin',
        ativo: true,
      })
      await setDoc(doc(ctx.firestore(), 'users/leitor'), {
        role: 'reader',
        produtosPermitidos: ['p1'],
        verTecnico: true,
        ativo: true,
      })
    })
    const sid = idDaSugestao(REGRAS.arquivo, REGRAS.hash)
    const caminho = `articles/a1/suggestions/${sid}`
    await assertSucceeds(
      getDoc(doc(testEnv.authenticatedContext('admin').firestore(), caminho)),
    )
    await assertFails(
      getDoc(doc(testEnv.authenticatedContext('leitor').firestore(), caminho)),
    )
  })
})
