import { readFileSync } from 'node:fs'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-docs-hub',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('firestore.rules (Fase 0 — nega tudo)', () => {
  it('nega leitura para usuários não autenticados', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'blocks/qualquer')))
  })

  it('nega leitura mesmo para usuários autenticados', async () => {
    const db = testEnv.authenticatedContext('usuario-1').firestore()
    await assertFails(getDoc(doc(db, 'blocks/qualquer')))
  })

  it('nega escrita para usuários autenticados', async () => {
    const db = testEnv.authenticatedContext('usuario-1').firestore()
    await assertFails(setDoc(doc(db, 'blocks/qualquer'), { nome: 'Teste' }))
  })
})
