import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
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
    await setDoc(doc(db, 'users/inativo'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      ativo: false,
    })
    await setDoc(doc(db, 'users/tecnico'), {
      role: 'reader',
      produtosPermitidos: ['p1'],
      verTecnico: true,
    })
    await setDoc(doc(db, 'blocks/p1'), { productId: 'p1', parentId: null })
    await setDoc(doc(db, 'blocks/p2'), { productId: 'p2', parentId: null })
    await setDoc(doc(db, 'articles/pub'), {
      productId: 'p1',
      status: 'published',
      publico: 'usuario',
      views: 0,
      titulo: 'Pub',
    })
    await setDoc(doc(db, 'searchIndex/p1'), { itens: [] })
    await setDoc(doc(db, 'searchIndex/p2'), { itens: [] })
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

describe('firestore.rules — usuários e permissões (Fase 2)', () => {
  it('conta desativada perde todo o acesso', async () => {
    const db = testEnv.authenticatedContext('inativo').firestore()
    await assertFails(getDoc(doc(db, 'blocks/p1')))
    await assertFails(getDoc(doc(db, 'users/inativo')))
  })

  it('leitor com verTecnico lê artigo técnico', async () => {
    const db = testEnv.authenticatedContext('tecnico').firestore()
    await assertSucceeds(getDoc(doc(db, 'articles/tec')))
  })

  it('só admin cria e altera usuários', async () => {
    const admin = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(
      setDoc(doc(admin, 'users/novo'), { role: 'reader', nome: 'N' }),
    )
    await assertSucceeds(getDoc(doc(admin, 'users/leitor')))
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(setDoc(doc(leitor, 'users/novo2'), { role: 'admin' }))
  })

  it('leitor soma 1 em views e mais nada', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'articles/pub'), { views: increment(1) }),
    )
    await assertFails(
      updateDoc(doc(db, 'articles/pub'), { views: increment(5) }),
    )
    await assertFails(updateDoc(doc(db, 'articles/pub'), { titulo: 'x' }))
    await assertFails(
      updateDoc(doc(db, 'articles/pub'), { views: increment(1), titulo: 'x' }),
    )
  })

  it('leitor não soma views em artigo que não pode ler', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(
      updateDoc(doc(db, 'articles/tec'), { views: increment(1) }),
    )
    await assertFails(
      updateDoc(doc(db, 'articles/outro'), { views: increment(1) }),
    )
  })

  it('leitor cria e incrementa viewsDaily em +1, sem ler', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    const ref = doc(db, 'articles/pub/viewsDaily/2026-01-01')
    await assertSucceeds(setDoc(ref, { count: 1 }))
    await assertSucceeds(updateDoc(ref, { count: increment(1) }))
    await assertFails(updateDoc(ref, { count: increment(10) }))
    await assertFails(getDoc(ref))
    await assertFails(
      setDoc(doc(db, 'articles/pub/viewsDaily/2026-01-02'), { count: 9 }),
    )
  })

  it('searchIndex: leitor lê só os produtos permitidos', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(db, 'searchIndex/p1')))
    await assertFails(getDoc(doc(db, 'searchIndex/p2')))
    await assertFails(setDoc(doc(db, 'searchIndex/p1'), { itens: [] }))
  })

  it('auditLog: admin cria e lê, mas não altera nem exclui', async () => {
    const admin = testEnv.authenticatedContext('admin').firestore()
    const ref = doc(admin, 'auditLog/a1')
    await assertSucceeds(
      setDoc(ref, {
        usuarioId: 'admin',
        acao: 'artigo.criar',
        alvo: 'articles/x',
        data: 1,
      }),
    )
    await assertSucceeds(getDoc(ref))
    await assertFails(updateDoc(ref, { acao: 'outra' }))
    await assertFails(deleteDoc(ref))
    await assertFails(
      setDoc(doc(admin, 'auditLog/a2'), { usuarioId: 'outro', acao: 'x' }),
    )
  })

  it('auditLog: leitor não lê nem escreve', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(db, 'auditLog/a1')))
    await assertFails(setDoc(doc(db, 'auditLog/a3'), { usuarioId: 'leitor' }))
  })
})
