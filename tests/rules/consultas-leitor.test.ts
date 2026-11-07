import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-docs-hub-consultas',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/tecnico'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      verTecnico: true,
    })
    await setDoc(doc(db, 'users/leitor'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
    })
    await setDoc(doc(db, 'blocks/p1'), { productId: 'p1', parentId: null })
    await setDoc(doc(db, 'blocks/s1'), { productId: 'p1', parentId: 'p1' })
    await setDoc(doc(db, 'blocks/p2'), { productId: 'p2', parentId: null })
    await setDoc(doc(db, 'articles/a1'), {
      productId: 'p1',
      blockId: 's1',
      status: 'published',
      publico: 'usuario',
    })
    await setDoc(doc(db, 'articles/a2'), {
      productId: 'p2',
      blockId: 'p2',
      status: 'published',
      publico: 'usuario',
    })
  })
})

afterAll(() => testEnv.cleanup())

// As telas fazem consultas (não só leituras de um documento). Uma regra que
// depende dos dados do documento só aceita a consulta se ela provar, pelos
// filtros, que só traz o que o leitor pode ver.
describe('firestore.rules — consultas feitas por um leitor', () => {
  const leitor = () => testEnv.authenticatedContext('leitor').firestore()

  it('árvore do produto (filtra por productId)', async () => {
    await assertSucceeds(
      getDocs(
        query(collection(leitor(), 'blocks'), where('productId', '==', 'p1')),
      ),
    )
  })

  it('filhos de um bloco (productId + parentId, como o app faz)', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(leitor(), 'blocks'),
          where('productId', '==', 'p1'),
          where('parentId', '==', 'p1'),
        ),
      ),
    )
  })

  it('sem o productId na consulta o Firestore nega (por isso o app sempre o envia)', async () => {
    await assertFails(
      getDocs(
        query(collection(leitor(), 'blocks'), where('parentId', '==', 'p1')),
      ),
    )
  })

  it('artigos de um bloco, leitor comum: produto + publicado + público usuário', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(leitor(), 'articles'),
          where('productId', '==', 'p1'),
          where('blockId', '==', 's1'),
          where('status', '==', 'published'),
          where('publico', '==', 'usuario'),
        ),
      ),
    )
  })

  it('artigos de um bloco, leitor com permissão técnica: produto + publicado', async () => {
    const tecnico = testEnv.authenticatedContext('tecnico').firestore()
    await assertSucceeds(
      getDocs(
        query(
          collection(tecnico, 'articles'),
          where('productId', '==', 'p1'),
          where('blockId', '==', 's1'),
          where('status', '==', 'published'),
        ),
      ),
    )
  })

  it('leitor comum sem filtrar o público é negado', async () => {
    await assertFails(
      getDocs(
        query(
          collection(leitor(), 'articles'),
          where('productId', '==', 'p1'),
          where('blockId', '==', 's1'),
          where('status', '==', 'published'),
        ),
      ),
    )
  })

  it('consulta de produto não permitido continua negada', async () => {
    await assertFails(
      getDocs(
        query(collection(leitor(), 'blocks'), where('productId', '==', 'p2')),
      ),
    )
  })
})
