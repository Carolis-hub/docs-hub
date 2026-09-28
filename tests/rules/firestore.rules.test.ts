import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-docs-hub',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await setDoc(doc(db, 'users/admin-1'), {
      nome: 'Admin',
      email: 'admin@teste.com',
      role: 'admin',
      produtosPermitidos: [],
      verTecnico: true,
      ativo: true,
    })
    await setDoc(doc(db, 'users/leitor-ecm'), {
      nome: 'Leitor ECM',
      email: 'ecm@teste.com',
      role: 'reader',
      produtosPermitidos: ['ecm'],
      verTecnico: false,
      ativo: true,
    })
    await setDoc(doc(db, 'users/leitor-bpm'), {
      nome: 'Leitor BPM',
      email: 'bpm@teste.com',
      role: 'reader',
      produtosPermitidos: ['bpm'],
      verTecnico: false,
      ativo: true,
    })
    await setDoc(doc(db, 'users/leitor-bpm-tecnico'), {
      nome: 'Leitor BPM técnico',
      email: 'bpm-tecnico@teste.com',
      role: 'reader',
      produtosPermitidos: ['bpm'],
      verTecnico: true,
      ativo: true,
    })
    await setDoc(doc(db, 'users/leitor-desativado'), {
      nome: 'Leitor desativado',
      email: 'desativado@teste.com',
      role: 'reader',
      produtosPermitidos: ['bpm'],
      verTecnico: true,
      ativo: false,
    })

    await setDoc(doc(db, 'blocks/bpm'), {
      nome: 'BPM',
      slug: 'bpm',
      descricao: '',
      icone: '',
      ordem: 0,
      parentId: null,
      productId: 'bpm',
    })
    await setDoc(doc(db, 'blocks/ecm'), {
      nome: 'ECM',
      slug: 'ecm',
      descricao: '',
      icone: '',
      ordem: 1,
      parentId: null,
      productId: 'ecm',
    })

    await setDoc(doc(db, 'articles/artigo-bpm-publicado'), {
      blockId: 'bpm',
      productId: 'bpm',
      titulo: 'Artigo BPM publicado',
      status: 'published',
      publico: 'usuario',
      views: 0,
    })
    await setDoc(doc(db, 'articles/artigo-bpm-rascunho'), {
      blockId: 'bpm',
      productId: 'bpm',
      titulo: 'Artigo BPM rascunho',
      status: 'draft',
      publico: 'usuario',
      views: 0,
    })
    await setDoc(doc(db, 'articles/artigo-bpm-tecnico'), {
      blockId: 'bpm',
      productId: 'bpm',
      titulo: 'Artigo BPM técnico',
      status: 'published',
      publico: 'tecnico',
      views: 0,
    })
    await setDoc(doc(db, 'articles/artigo-ecm-publicado'), {
      blockId: 'ecm',
      productId: 'ecm',
      titulo: 'Artigo ECM publicado',
      status: 'published',
      publico: 'usuario',
      views: 0,
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('users/{uid}', () => {
  it('sem documento de usuário, nega tudo', async () => {
    const db = testEnv.authenticatedContext('sem-perfil').firestore()
    await assertFails(getDoc(doc(db, 'blocks/bpm')))
  })

  it('usuário desativado não acessa nada', async () => {
    const db = testEnv.authenticatedContext('leitor-desativado').firestore()
    await assertFails(getDoc(doc(db, 'blocks/bpm')))
  })

  it('leitor lê o próprio perfil, mas não o de outro usuário', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/leitor-bpm')))
    await assertFails(getDoc(doc(db, 'users/leitor-ecm')))
  })

  it('leitor não altera o próprio perfil', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertFails(updateDoc(doc(db, 'users/leitor-bpm'), { role: 'admin' }))
  })

  it('admin lê e escreve o perfil de qualquer usuário', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/leitor-bpm')))
    await assertSucceeds(
      updateDoc(doc(db, 'users/leitor-bpm'), { verTecnico: true }),
    )
    await updateDoc(doc(db, 'users/leitor-bpm'), { verTecnico: false })
  })
})

describe('blocks — isolamento por produto', () => {
  it('leitor da ECM não vê o bloco BPM por URL direta', async () => {
    const db = testEnv.authenticatedContext('leitor-ecm').firestore()
    await assertFails(getDoc(doc(db, 'blocks/bpm')))
    await assertSucceeds(getDoc(doc(db, 'blocks/ecm')))
  })

  it('leitor da ECM não consegue listar produtos incluindo BPM', async () => {
    const db = testEnv.authenticatedContext('leitor-ecm').firestore()
    const consultaComBpm = query(
      collection(db, 'blocks'),
      where('parentId', '==', null),
      where('productId', 'in', ['bpm']),
    )
    await assertFails(getDocs(consultaComBpm))

    const consultaSoEcm = query(
      collection(db, 'blocks'),
      where('parentId', '==', null),
      where('productId', 'in', ['ecm']),
    )
    const resultado = await assertSucceeds(getDocs(consultaSoEcm))
    expect(resultado.docs.map((d) => d.id)).toEqual(['ecm'])
  })

  it('leitor não escreve blocos', async () => {
    const db = testEnv.authenticatedContext('leitor-ecm').firestore()
    await assertFails(updateDoc(doc(db, 'blocks/ecm'), { nome: 'Outro' }))
  })

  it('admin lê e escreve qualquer bloco', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'blocks/bpm')))
    await assertSucceeds(updateDoc(doc(db, 'blocks/bpm'), { descricao: 'x' }))
    await updateDoc(doc(db, 'blocks/bpm'), { descricao: '' })
  })
})

describe('articles — status, produto e público técnico', () => {
  it('leitor da ECM não lê artigo da BPM por URL direta', async () => {
    const db = testEnv.authenticatedContext('leitor-ecm').firestore()
    await assertFails(getDoc(doc(db, 'articles/artigo-bpm-publicado')))
  })

  it('leitor da BPM lê artigo publicado de público usuário', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertSucceeds(getDoc(doc(db, 'articles/artigo-bpm-publicado')))
  })

  it('leitor sem verTecnico não lê artigo técnico', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertFails(getDoc(doc(db, 'articles/artigo-bpm-tecnico')))
  })

  it('leitor com verTecnico lê artigo técnico do mesmo produto', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm-tecnico').firestore()
    await assertSucceeds(getDoc(doc(db, 'articles/artigo-bpm-tecnico')))
  })

  it('leitor não lê rascunho', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertFails(getDoc(doc(db, 'articles/artigo-bpm-rascunho')))
  })

  it('leitor só incrementa o campo views, nada mais', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertSucceeds(
      updateDoc(doc(db, 'articles/artigo-bpm-publicado'), {
        views: increment(1),
      }),
    )
    await assertFails(
      updateDoc(doc(db, 'articles/artigo-bpm-publicado'), {
        titulo: 'Alterado',
      }),
    )
  })

  it('leitor não cria nem exclui artigos', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertFails(
      setDoc(doc(db, 'articles/novo'), {
        blockId: 'bpm',
        productId: 'bpm',
        status: 'draft',
        publico: 'usuario',
      }),
    )
    await assertFails(deleteDoc(doc(db, 'articles/artigo-bpm-publicado')))
  })

  it('admin lê, cria, atualiza e exclui artigos livremente', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(getDoc(doc(db, 'articles/artigo-bpm-rascunho')))
    await assertSucceeds(
      updateDoc(doc(db, 'articles/artigo-bpm-rascunho'), {
        titulo: 'Editado pelo admin',
      }),
    )
  })
})

describe('auditLog', () => {
  it('admin cria e lê o auditLog, mas não pode excluir', async () => {
    const db = testEnv.authenticatedContext('admin-1').firestore()
    await assertSucceeds(
      setDoc(doc(db, 'auditLog/log-1'), {
        usuarioId: 'admin-1',
        acao: 'criar_bloco',
        alvo: 'bpm',
      }),
    )
    await assertSucceeds(getDoc(doc(db, 'auditLog/log-1')))
    await assertFails(deleteDoc(doc(db, 'auditLog/log-1')))
  })

  it('leitor não lê nem escreve o auditLog', async () => {
    const db = testEnv.authenticatedContext('leitor-bpm').firestore()
    await assertFails(getDoc(doc(db, 'auditLog/log-1')))
    await assertFails(
      setDoc(doc(db, 'auditLog/log-2'), {
        usuarioId: 'leitor-bpm',
        acao: 'criar_bloco',
        alvo: 'x',
      }),
    )
  })
})
