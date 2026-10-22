import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-docs-hub',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/admin'), { role: 'admin', nome: 'A' })
    await setDoc(doc(db, 'users/leitor'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      verTecnico: false,
    })
    await setDoc(doc(db, 'blocks/p1'), { productId: 'p1', parentId: null })
    await setDoc(doc(db, 'blocks/p2'), { productId: 'p2', parentId: null })
    await setDoc(doc(db, 'articles/pub'), {
      productId: 'p1',
      status: 'published',
      publico: 'usuario',
    })
    await setDoc(doc(db, 'articles/tec'), {
      productId: 'p1',
      status: 'published',
      publico: 'tecnico',
    })
    await setDoc(doc(db, 'articles/rasc'), {
      productId: 'p1',
      status: 'draft',
      publico: 'usuario',
    })
    await setDoc(doc(db, 'articles/outro'), {
      productId: 'p2',
      status: 'published',
      publico: 'usuario',
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('firestore.rules — conteúdo (Fase 1)', () => {
  it('nega tudo sem login', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'blocks/p1')))
  })

  it('nega tudo a conta sem documento em users', async () => {
    const db = testEnv.authenticatedContext('sem-perfil').firestore()
    await assertFails(getDoc(doc(db, 'blocks/p1')))
  })

  it('admin lê e escreve blocos e artigos', async () => {
    const db = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(getDoc(doc(db, 'articles/rasc')))
    await assertSucceeds(setDoc(doc(db, 'blocks/novo'), { productId: 'p1' }))
    await assertSucceeds(
      setDoc(doc(db, 'articles/pub/versions/1'), { versao: 1 }),
    )
  })

  it('leitor lê blocos e artigos publicados do seu produto', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(db, 'blocks/p1')))
    await assertSucceeds(getDoc(doc(db, 'articles/pub')))
  })

  it('leitor não lê produto não permitido', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(db, 'blocks/p2')))
    await assertFails(getDoc(doc(db, 'articles/outro')))
  })

  it('leitor não lê rascunho nem artigo técnico sem verTecnico', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(db, 'articles/rasc')))
    await assertFails(getDoc(doc(db, 'articles/tec')))
  })

  it('leitor não escreve conteúdo nem versões', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(setDoc(doc(db, 'blocks/x'), { productId: 'p1' }))
    await assertFails(setDoc(doc(db, 'articles/pub'), { titulo: 'x' }))
    await assertFails(getDoc(doc(db, 'articles/pub/versions/1')))
  })

  it('leitor lê só o próprio perfil', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/leitor')))
    await assertFails(getDoc(doc(db, 'users/admin')))
    await assertFails(setDoc(doc(db, 'users/leitor'), { role: 'admin' }))
  })
})
