import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collectionGroup,
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
    await setDoc(doc(db, 'unidades/u1'), { nome: 'Process Solution', ordem: 0 })
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
    await setDoc(doc(db, 'searchIndex/p1/partes/bpm'), { itens: [] })
    await setDoc(doc(db, 'searchIndex/p2/partes/bpm'), { itens: [] })
    await setDoc(doc(db, 'searchIndexTecnico/p1'), { itens: [] })
    await setDoc(doc(db, 'searchIndexTecnico/p1/partes/bpm'), { itens: [] })
    await setDoc(doc(db, 'searchIndexTecnico/p2'), { itens: [] })
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
    const dia = '2026-01-01'
    const ref = doc(db, `articles/pub/viewsDaily/${dia}`)
    await assertSucceeds(setDoc(ref, { count: 1, dia }))
    await assertSucceeds(
      setDoc(ref, { count: increment(1), dia }, { merge: true }),
    )
    await assertFails(updateDoc(ref, { count: increment(10) }))
    await assertFails(getDoc(ref))
    await assertFails(
      setDoc(doc(db, 'articles/pub/viewsDaily/2026-01-02'), {
        count: 9,
        dia: '2026-01-02',
      }),
    )
  })

  it('viewsDaily: `dia` precisa repetir o id e não aceita campos extras', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(
      setDoc(doc(db, 'articles/pub/viewsDaily/2026-02-01'), {
        count: 1,
        dia: '2026-02-02',
      }),
    )
    await assertFails(
      setDoc(doc(db, 'articles/pub/viewsDaily/2026-02-03'), {
        count: 1,
        dia: '2026-02-03',
        extra: true,
      }),
    )
  })

  it('viewsDaily: só admin consulta o conjunto de todos os artigos', async () => {
    const admin = testEnv.authenticatedContext('admin').firestore()
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(admin, 'viewsDaily'),
          where('dia', '>=', '2026-01-01'),
        ),
      ),
    )
    await assertFails(
      getDocs(
        query(
          collectionGroup(leitor, 'viewsDaily'),
          where('dia', '>=', '2026-01-01'),
        ),
      ),
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

describe('firestore.rules — busca (Fase 3)', () => {
  it('searchIndex dividido: leitor lê as partes só dos seus produtos', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(db, 'searchIndex/p1/partes/bpm')))
    await assertFails(getDoc(doc(db, 'searchIndex/p2/partes/bpm')))
    await assertFails(
      setDoc(doc(db, 'searchIndex/p1/partes/bpm'), { itens: [] }),
    )
  })

  it('índice técnico: só quem tem verTecnico (e o produto) lê', async () => {
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(leitor, 'searchIndexTecnico/p1')))
    await assertFails(getDoc(doc(leitor, 'searchIndexTecnico/p1/partes/bpm')))

    const tecnico = testEnv.authenticatedContext('tecnico').firestore()
    await assertSucceeds(getDoc(doc(tecnico, 'searchIndexTecnico/p1')))
    await assertSucceeds(
      getDoc(doc(tecnico, 'searchIndexTecnico/p1/partes/bpm')),
    )
    // Ver técnico não dá acesso a produto que a pessoa não tem.
    await assertFails(getDoc(doc(tecnico, 'searchIndexTecnico/p2')))
    await assertFails(
      setDoc(doc(tecnico, 'searchIndexTecnico/p1'), { itens: [] }),
    )

    const inativo = testEnv.authenticatedContext('inativo').firestore()
    await assertFails(getDoc(doc(inativo, 'searchIndexTecnico/p1')))

    const admin = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(getDoc(doc(admin, 'searchIndexTecnico/p2')))
    await assertSucceeds(
      setDoc(doc(admin, 'searchIndexTecnico/p1/partes/ecm'), { itens: [] }),
    )
  })

  it('admin escreve o índice e suas partes', async () => {
    const db = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(setDoc(doc(db, 'searchIndex/p1'), { itens: [] }))
    await assertSucceeds(
      setDoc(doc(db, 'searchIndex/p1/partes/ecm'), { itens: [] }),
    )
  })

  it('searchMisses: leitor cria com 1 e soma 1, sem ler', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    const ref = doc(db, 'searchMisses/termo-x')
    const dados = { termo: 'termo x', ultimaVez: 1 }
    await assertSucceeds(
      setDoc(ref, { ...dados, count: increment(1) }, { merge: true }),
    )
    await assertSucceeds(
      setDoc(ref, { ...dados, count: increment(1) }, { merge: true }),
    )
    await assertFails(
      setDoc(ref, { ...dados, count: increment(5) }, { merge: true }),
    )
    await assertFails(getDoc(ref))
  })

  it('searchMisses: rejeita campos extras e conta sem perfil', async () => {
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(
      setDoc(doc(leitor, 'searchMisses/outro'), {
        termo: 'a',
        count: 1,
        ultimaVez: 1,
        extra: true,
      }),
    )
    const semPerfil = testEnv.authenticatedContext('sem-perfil').firestore()
    await assertFails(
      setDoc(doc(semPerfil, 'searchMisses/outro2'), {
        termo: 'a',
        count: 1,
        ultimaVez: 1,
      }),
    )
  })

  it('searchMisses: aceita o produto, se a pessoa pode vê-lo, e não deixa trocá-lo', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    const ref = doc(db, 'searchMisses/p1__boleto')
    const dados = { termo: 'boleto', productId: 'p1', ultimaVez: 1 }
    await assertSucceeds(
      setDoc(ref, { ...dados, count: increment(1) }, { merge: true }),
    )
    await assertSucceeds(
      setDoc(ref, { ...dados, count: increment(1) }, { merge: true }),
    )
    await assertFails(
      setDoc(
        ref,
        { ...dados, productId: 'p2', count: increment(1) },
        { merge: true },
      ),
    )
    await assertFails(
      setDoc(doc(db, 'searchMisses/p2__boleto'), {
        termo: 'boleto',
        productId: 'p2',
        count: 1,
        ultimaVez: 1,
      }),
    )
  })

  it('searchFeedback: leitor soma um voto por vez, no seu produto, sem ler', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    const ref = doc(db, 'searchFeedback/p1__envio')
    const base = { termo: 'envio', productId: 'p1', ultimaVez: 1 }
    const voto = (sim: number, nao: number) =>
      setDoc(
        ref,
        { ...base, sim: increment(sim), nao: increment(nao) },
        { merge: true },
      )
    await assertSucceeds(voto(0, 1)) // cria com um "não"
    await assertSucceeds(voto(1, 0)) // soma um "sim"
    await assertFails(voto(1, 1)) // dois votos de uma vez
    await assertFails(voto(5, 0)) // mais de um
    await assertFails(voto(0, 0)) // nenhum voto
    await assertFails(voto(-1, 0)) // desfazer voto dos outros
    await assertFails(
      setDoc(
        ref,
        { ...base, termo: 'outro', sim: increment(1) },
        { merge: true },
      ),
    )
    await assertFails(getDoc(ref))
  })

  it('searchFeedback: rejeita outro produto, campos extras e quem não tem perfil', async () => {
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    const voto = { termo: 'x', sim: 1, nao: 0, ultimaVez: 1 }
    await assertFails(
      setDoc(doc(leitor, 'searchFeedback/p2__x'), { ...voto, productId: 'p2' }),
    )
    await assertFails(
      setDoc(doc(leitor, 'searchFeedback/p1__x'), {
        ...voto,
        productId: 'p1',
        uid: 'leitor',
      }),
    )
    await assertFails(
      setDoc(doc(leitor, 'searchFeedback/p1__y'), {
        ...voto,
        productId: 'p1',
        sim: 3,
      }),
    )
    const semPerfil = testEnv.authenticatedContext('sem-perfil').firestore()
    await assertFails(
      setDoc(doc(semPerfil, 'searchFeedback/p1__z'), {
        ...voto,
        productId: 'p1',
      }),
    )
    const inativo = testEnv.authenticatedContext('inativo').firestore()
    await assertFails(
      setDoc(doc(inativo, 'searchFeedback/p1__z'), {
        ...voto,
        productId: 'p1',
      }),
    )
  })

  it('searchFeedback: admin lê', async () => {
    const db = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(getDoc(doc(db, 'searchFeedback/p1__envio')))
  })

  it('searchMisses: admin lê', async () => {
    const db = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(getDoc(doc(db, 'searchMisses/termo-x')))
  })
})

describe('firestore.rules — sugestões da IA (Fase 6)', () => {
  it('só admin lê a fila de sugestões pendentes (consulta de grupo)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'articles/pub/suggestions/s1'), {
        status: 'pending',
      })
    })
    const consulta = (
      db: ReturnType<
        ReturnType<typeof testEnv.authenticatedContext>['firestore']
      >,
    ) =>
      getDocs(
        query(
          collectionGroup(db, 'suggestions'),
          where('status', '==', 'pending'),
        ),
      )
    await assertSucceeds(
      consulta(testEnv.authenticatedContext('admin').firestore()),
    )
    await assertFails(
      consulta(testEnv.authenticatedContext('leitor').firestore()),
    )
  })

  it('admin decide a sugestão; leitor não lê nem escreve', async () => {
    const admin = testEnv.authenticatedContext('admin').firestore()
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    const ref = 'articles/pub/suggestions/s1'
    await assertSucceeds(updateDoc(doc(admin, ref), { status: 'discarded' }))
    await assertFails(getDoc(doc(leitor, ref)))
    await assertFails(updateDoc(doc(leitor, ref), { status: 'approved' }))
  })
})

describe('firestore.rules — unidades de negócio', () => {
  it('nega a leitura sem login e a conta sem perfil ou inativa', async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'unidades/u1')),
    )
    await assertFails(
      getDoc(
        doc(
          testEnv.authenticatedContext('sem-perfil').firestore(),
          'unidades/u1',
        ),
      ),
    )
    await assertFails(
      getDoc(
        doc(testEnv.authenticatedContext('inativo').firestore(), 'unidades/u1'),
      ),
    )
  })

  it('qualquer usuário ativo lê as unidades', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(db, 'unidades/u1')))
  })

  it('só admin cria, edita e exclui unidades', async () => {
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(setDoc(doc(leitor, 'unidades/nova'), { nome: 'X' }))
    await assertFails(updateDoc(doc(leitor, 'unidades/u1'), { nome: 'Y' }))
    await assertFails(deleteDoc(doc(leitor, 'unidades/u1')))

    const admin = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(setDoc(doc(admin, 'unidades/nova'), { nome: 'X' }))
    await assertSucceeds(updateDoc(doc(admin, 'unidades/nova'), { nome: 'Y' }))
    await assertSucceeds(deleteDoc(doc(admin, 'unidades/nova')))
  })

  it('a unidade não dá acesso a produtos: o bloco continua restrito', async () => {
    const db = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(db, 'blocks/p2')))
  })
})

describe('firestore.rules — registro das fontes de ingestão', () => {
  it('só admin lê e escreve', async () => {
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertFails(getDoc(doc(leitor, 'fontes/f1')))
    await assertFails(setDoc(doc(leitor, 'fontes/f1'), { fonteId: 'x' }))
    const admin = testEnv.authenticatedContext('admin').firestore()
    await assertSucceeds(setDoc(doc(admin, 'fontes/f1'), { fonteId: 'x' }))
    await assertSucceeds(getDoc(doc(admin, 'fontes/f1')))
  })
})

describe('firestore.rules — governança editorial (Fase 4)', () => {
  const admin = () => testEnv.authenticatedContext('admin').firestore()
  const leitor = () => testEnv.authenticatedContext('leitor').firestore()

  it('a alteração pendente e os comentários são só de admin', async () => {
    await assertSucceeds(
      setDoc(doc(admin(), 'articles/pub/revisoes/atual'), {
        status: 'draft',
        titulo: 'x',
      }),
    )
    await assertSucceeds(
      setDoc(doc(admin(), 'articles/pub/comentarios/c1'), {
        texto: 'x',
        tipo: 'comentario',
      }),
    )
    await assertSucceeds(getDoc(doc(admin(), 'articles/pub/revisoes/atual')))
    await assertFails(getDoc(doc(leitor(), 'articles/pub/revisoes/atual')))
    await assertFails(getDoc(doc(leitor(), 'articles/pub/comentarios/c1')))
    await assertFails(
      setDoc(doc(leitor(), 'articles/pub/comentarios/c2'), { texto: 'x' }),
    )
    await assertFails(
      setDoc(doc(leitor(), 'articles/pub/revisoes/atual'), { titulo: 'x' }),
    )
  })

  it('leitor só enxerga artigo publicado: em revisão, aprovado, reprovado e arquivado ficam escondidos', async () => {
    for (const status of [
      'draft',
      'review',
      'approved',
      'rejected',
      'archived',
    ]) {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `articles/st-${status}`), {
          productId: 'p1',
          status,
          publico: 'usuario',
          views: 0,
        })
      })
      await assertFails(getDoc(doc(leitor(), `articles/st-${status}`)))
      await assertSucceeds(getDoc(doc(admin(), `articles/st-${status}`)))
    }
  })
})

describe('firestore.rules — assistente de IA', () => {
  const admin = () => testEnv.authenticatedContext('admin').firestore()
  const leitor = () => testEnv.authenticatedContext('leitor').firestore()

  beforeAll(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, 'assistenteLog/do-leitor'), {
        uid: 'leitor',
        pergunta: 'x',
        feedback: null,
      })
      await setDoc(doc(d, 'assistenteLog/do-tecnico'), {
        uid: 'tecnico',
        pergunta: 'y',
        feedback: null,
      })
      await setDoc(doc(d, 'assistenteUso/g_2026-11-01'), {
        tipo: 'global',
        perguntas: 1,
      })
    })
  })

  it('contadores de uso: só admin lê, ninguém escreve pelo navegador', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'assistenteUso/g_2026-11-01')))
    await assertFails(getDoc(doc(leitor(), 'assistenteUso/g_2026-11-01')))
    await assertFails(
      setDoc(doc(admin(), 'assistenteUso/g_2026-11-02'), { perguntas: 0 }),
    )
    await assertFails(
      updateDoc(doc(leitor(), 'assistenteUso/g_2026-11-01'), { perguntas: 0 }),
    )
  })

  it('registro de perguntas: só admin lê; ninguém cria nem apaga pelo navegador', async () => {
    await assertSucceeds(getDoc(doc(admin(), 'assistenteLog/do-leitor')))
    await assertFails(getDoc(doc(leitor(), 'assistenteLog/do-leitor')))
    await assertFails(
      setDoc(doc(leitor(), 'assistenteLog/novo'), { uid: 'leitor' }),
    )
    await assertFails(
      setDoc(doc(admin(), 'assistenteLog/novo'), { uid: 'admin' }),
    )
    await assertFails(deleteDoc(doc(leitor(), 'assistenteLog/do-leitor')))
  })

  it('o dono avalia a própria resposta, só o campo "feedback" e só com valor válido', async () => {
    await assertSucceeds(
      updateDoc(doc(leitor(), 'assistenteLog/do-leitor'), { feedback: 'util' }),
    )
    await assertSucceeds(
      updateDoc(doc(leitor(), 'assistenteLog/do-leitor'), { feedback: 'ruim' }),
    )
    await assertFails(
      updateDoc(doc(leitor(), 'assistenteLog/do-leitor'), {
        feedback: 'otimo',
      }),
    )
    await assertFails(
      updateDoc(doc(leitor(), 'assistenteLog/do-leitor'), {
        pergunta: 'mudei',
      }),
    )
    await assertFails(
      updateDoc(doc(leitor(), 'assistenteLog/do-leitor'), {
        feedback: 'util',
        custoUsd: 0,
      }),
    )
  })

  it('não dá para avaliar a resposta de outra pessoa', async () => {
    await assertFails(
      updateDoc(doc(leitor(), 'assistenteLog/do-tecnico'), {
        feedback: 'util',
      }),
    )
  })
})

describe('firestore.rules — painel de sincronização', () => {
  it('só admin lê o resumo das fontes, e ninguém escreve pelo navegador', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sincronizacoes/di-docs'), {
        fonteId: 'di-docs',
      })
    })
    const admin = testEnv.authenticatedContext('admin').firestore()
    const leitor = testEnv.authenticatedContext('leitor').firestore()
    await assertSucceeds(getDoc(doc(admin, 'sincronizacoes/di-docs')))
    await assertFails(getDoc(doc(leitor, 'sincronizacoes/di-docs')))
    await assertFails(
      setDoc(doc(admin, 'sincronizacoes/novo'), { fonteId: 'x' }),
    )
    await assertFails(
      updateDoc(doc(leitor, 'sincronizacoes/di-docs'), { fonteId: 'y' }),
    )
  })
})
