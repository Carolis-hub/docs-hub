import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc } from 'firebase/firestore'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarResolvedorImagens } from '../../scripts/migrate/images'
import { validarManifesto } from '../../scripts/migrate/manifest'
import { planejar } from '../../scripts/migrate/plan'
import type { ManifestoArtigo } from '../../scripts/migrate/types'
import { gravar } from '../../scripts/migrate/write'

const PROJETO = 'demo-docs-hub'
const EXEMPLO = path.resolve('scripts/migrate/exemplo')

let testEnv: RulesTestEnvironment

async function planoDoExemplo() {
  const bruto = JSON.parse(
    await readFile(path.join(EXEMPLO, 'manifesto.json'), 'utf8'),
  )
  const v = validarManifesto(bruto)
  if (!('manifesto' in v)) throw new Error(v.erros.join('; '))
  return planejar(v.manifesto, {
    agora: 1_700_000_000_000,
    autorId: 'migracao',
    lerConteudo: (a: ManifestoArtigo) =>
      a.arquivo
        ? readFile(path.join(EXEMPLO, a.arquivo), 'utf8')
        : Promise.resolve(a.conteudo ?? ''),
    resolverImagem: criarResolvedorImagens({
      baseDir: EXEMPLO,
      cloudinary: { cloudName: 'x', uploadPreset: 'y' },
      cache: new Map(),
      enviar: async (img) =>
        `https://res.cloudinary.test/${img.hash.slice(0, 8)}`,
    }),
  })
}

const opts = {
  projectId: PROJETO,
  sobrescrever: false,
  autorId: 'migracao',
  agora: 1_700_000_000_000,
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJETO,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.clearFirestore()
  await testEnv.cleanup()
})

describe('migração gravada no Firestore (Emulator)', () => {
  it('grava blocos, artigos, versões, índice de busca e auditoria', async () => {
    const plano = await planoDoExemplo()
    const r = await gravar(plano, opts)
    expect(r).toMatchObject({
      blocosGravados: 3,
      artigosGravados: 3,
      artigosPulados: 0,
      indices: 1,
    })

    const db = getFirestore(
      getApps()[0] ?? initializeApp({ projectId: PROJETO }),
    )
    const login = plano.artigos[0]!
    const snap = await db.collection('articles').doc(login.id).get()
    expect(snap.data()).toMatchObject({
      titulo: 'Como acessar o BPM',
      status: 'published',
      versao: 1,
      views: 0,
      productId: login.productId,
    })
    expect(
      (
        await db
          .collection('articles')
          .doc(login.id)
          .collection('versions')
          .doc('1')
          .get()
      ).exists,
    ).toBe(true)

    // Rascunho: sem versão publicada e fora do índice.
    const rascunho = plano.artigos[2]!
    expect(
      (
        await db
          .collection('articles')
          .doc(rascunho.id)
          .collection('versions')
          .get()
      ).size,
    ).toBe(0)
    const indice = (
      await db.collection('searchIndex').doc(login.productId).get()
    ).data()
    expect(indice?.itens.map((i: { id: string }) => i.id).sort()).toEqual(
      [plano.artigos[0]!.id, plano.artigos[1]!.id].sort(),
    )
    const auditoria = await db
      .collection('auditLog')
      .where('acao', '==', 'migracao.importar')
      .get()
    expect(auditoria.size).toBe(1)
  })

  it('é idempotente: rodar de novo não duplica nem sobrescreve', async () => {
    const plano = await planoDoExemplo()
    const r = await gravar(plano, opts)
    expect(r).toMatchObject({
      blocosGravados: 0,
      blocosPulados: 3,
      artigosGravados: 0,
      artigosPulados: 3,
    })
  })

  it('uma segunda rodada refaz o índice de busca de artigos que já existiam', async () => {
    const plano = await planoDoExemplo()
    const db = getFirestore(
      getApps()[0] ?? initializeApp({ projectId: PROJETO }),
    )
    const produto = plano.artigos[0]!.productId
    // Simula uma queda no meio da primeira gravação: artigos gravados, índice não.
    await db.collection('searchIndex').doc(produto).delete()

    const r = await gravar(plano, opts)
    expect(r).toMatchObject({
      artigosGravados: 0,
      artigosPulados: 3,
      indices: 1,
    })
    const indice = (
      await db.collection('searchIndex').doc(produto).get()
    ).data()
    expect(indice?.itens.map((i: { id: string }) => i.id).sort()).toEqual(
      [plano.artigos[0]!.id, plano.artigos[1]!.id].sort(),
    )
  })

  it('recria a versão do histórico que faltar em um artigo que já existia', async () => {
    const plano = await planoDoExemplo()
    const db = getFirestore(
      getApps()[0] ?? initializeApp({ projectId: PROJETO }),
    )
    const login = plano.artigos[0]!
    const refVersao = db
      .collection('articles')
      .doc(login.id)
      .collection('versions')
      .doc('1')
    await refVersao.delete()

    const r = await gravar(plano, opts)
    expect(r).toMatchObject({ artigosGravados: 0, versoesRecriadas: 1 })
    expect((await refVersao.get()).data()).toMatchObject({
      versao: 1,
      titulo: 'Como acessar o BPM',
      origem: 'manual',
    })

    // Na rodada seguinte não há mais o que recriar.
    expect((await gravar(plano, opts)).versoesRecriadas).toBe(0)
  })

  it('com sobrescrever, mantém as views e sobe a versão', async () => {
    const plano = await planoDoExemplo()
    const db = getFirestore(
      getApps()[0] ?? initializeApp({ projectId: PROJETO }),
    )
    const login = plano.artigos[0]!
    await db.collection('articles').doc(login.id).update({ views: 42 })

    await gravar(plano, { ...opts, sobrescrever: true })
    const dados = (await db.collection('articles').doc(login.id).get()).data()
    expect(dados).toMatchObject({ views: 42, versao: 2 })
    const indice = (
      await db.collection('searchIndex').doc(login.productId).get()
    ).data()
    expect(indice?.itens).toHaveLength(2) // sem duplicar itens
  })

  it('o conteúdo migrado respeita as regras: leitor permitido lê, outro não', async () => {
    const plano = await planoDoExemplo()
    const [login, fluxo] = plano.artigos
    const produto = login!.productId
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { setDoc } = await import('firebase/firestore')
      const db = ctx.firestore()
      await setDoc(doc(db, 'users/leitor'), {
        role: 'reader',
        produtosPermitidos: [produto],
        verTecnico: false,
        ativo: true,
      })
      await setDoc(doc(db, 'users/outro'), {
        role: 'reader',
        produtosPermitidos: [],
        verTecnico: false,
        ativo: true,
      })
    })
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(leitor, 'articles', login!.id)))
    await assertSucceeds(getDoc(doc(leitor, 'blocks', login!.blockId)))
    await assertSucceeds(getDoc(doc(leitor, 'searchIndex', produto)))
    // artigo técnico e rascunho continuam protegidos
    await assertFails(getDoc(doc(leitor, 'articles', fluxo!.id)))
    await assertFails(getDoc(doc(leitor, 'articles', plano.artigos[2]!.id)))

    const outro = testEnv.authenticatedContext('outro').firestore()
    await assertFails(getDoc(doc(outro, 'articles', login!.id)))
  })
})
