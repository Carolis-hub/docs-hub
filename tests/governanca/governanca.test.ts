import { readFileSync } from 'node:fs'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleDraft } from '../../src/types/content'

// Os serviços usam o `db` do app; aqui ele aponta para o Emulator, com a sessão de um admin.
vi.mock('../../src/services/firebase', async () => {
  const { initializeTestEnvironment } =
    await import('@firebase/rules-unit-testing')
  const env = await initializeTestEnvironment({
    projectId: 'demo-docs-hub-governanca',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
  return {
    db: env.authenticatedContext('admin').firestore(),
    __env: env,
  }
})

import * as firebase from '../../src/services/firebase'
import {
  createArticle,
  deleteArticle,
  getArticle,
  listVersions,
} from '../../src/services/articles'
import {
  adicionarComentario,
  listarComentarios,
} from '../../src/services/comentarios'
import {
  aprovarEPublicar,
  aprovarSugestao,
  descartarRevisao,
  getRevisao,
  salvarAlteracoes,
  transitar,
} from '../../src/services/governanca'
import { listarAuditoriaDoArtigo } from '../../src/services/audit'

const { db } = firebase
const env = (
  firebase as unknown as {
    __env: import('@firebase/rules-unit-testing').RulesTestEnvironment
  }
).__env

const texto = (t: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
})
const rascunho = (
  t: string,
  extra: Partial<ArticleDraft> = {},
): ArticleDraft => ({
  titulo: `Título ${t}`,
  conteudo: texto(t),
  publico: 'usuario',
  categoria: '',
  ...extra,
})

const ADMIN = 'admin'
const indice = async () =>
  ((await getDoc(doc(db, 'searchIndex/p1'))).data()?.itens ?? []) as Array<{
    id: string
  }>

async function novoArtigo(t = 'inicial') {
  return createArticle(rascunho(t), 'p1', 'p1', ADMIN)
}
async function publicado(t = 'inicial') {
  const id = await novoArtigo(t)
  await transitar(id, 'enviar', ADMIN)
  await aprovarEPublicar(id, ADMIN)
  return id
}

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'users/admin'), { role: 'admin', nome: 'Ana' })
    await setDoc(doc(d, 'blocks/p1'), {
      productId: 'p1',
      parentId: null,
      nome: 'Produto',
    })
  })
})

describe('ciclo de vida (Emulator)', () => {
  it('rascunho → revisão → aprovado → publicado, com versão, aprovador, busca e trilha', async () => {
    const id = await novoArtigo()
    await transitar(id, 'enviar', ADMIN)
    expect((await getArticle(id))?.status).toBe('review')
    await transitar(id, 'aprovar', ADMIN)
    const aprovado = await getArticle(id)
    expect(aprovado).toMatchObject({ status: 'approved', aprovadoPor: ADMIN })
    expect(await indice()).toEqual([])

    const { versao } = await transitar(id, 'publicar', ADMIN)
    expect(versao).toBe(1)
    expect(await getArticle(id)).toMatchObject({
      status: 'published',
      versao: 1,
    })
    expect((await indice()).map((i) => i.id)).toEqual([id])

    const versoes = await listVersions(id)
    expect(versoes[0]).toMatchObject({ versao: 1, aprovadoPor: ADMIN })

    const trilha = await listarAuditoriaDoArtigo(id)
    // Da mais antiga para a mais nova (a consulta devolve a mais nova primeiro).
    expect(trilha.map((t) => t.acao).reverse()).toEqual([
      'artigo.criar',
      'artigo.enviar-revisao',
      'artigo.aprovar',
      'artigo.publicar',
    ])
    expect(trilha.every((t) => t.usuarioId === ADMIN)).toBe(true)
  })

  it('só publica o que foi aprovado', async () => {
    const id = await novoArtigo()
    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(
      'não vale para o artigo no estado "Rascunho"',
    )
    await transitar(id, 'enviar', ADMIN)
    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(
      '"Em revisão"',
    )
    await expect(transitar(id, 'aprovar', ADMIN)).resolves.toBeDefined()
    expect((await getArticle(id))?.status).toBe('approved')
  })

  it('reprovar exige comentário, que fica na conversa; depois reenvia', async () => {
    const id = await novoArtigo()
    await transitar(id, 'enviar', ADMIN)
    await expect(transitar(id, 'reprovar', ADMIN)).rejects.toThrow(
      'Explique o que precisa ser ajustado',
    )
    await expect(
      transitar(id, 'reprovar', ADMIN, { comentario: '   ' }),
    ).rejects.toThrow('Explique')
    expect((await getArticle(id))?.status).toBe('review')

    await transitar(id, 'reprovar', ADMIN, {
      comentario: 'Falta o passo 3',
      autorNome: 'Ana',
    })
    expect((await getArticle(id))?.status).toBe('rejected')
    const cs = await listarComentarios(id)
    expect(cs).toHaveLength(1)
    expect(cs[0]).toMatchObject({
      tipo: 'reprovacao',
      texto: 'Falta o passo 3',
      autorNome: 'Ana',
      alvo: 'artigo',
    })

    await transitar(id, 'enviar', ADMIN)
    expect((await getArticle(id))?.status).toBe('review')
  })

  it('comentário avulso e nota de aprovação ficam registrados', async () => {
    const id = await novoArtigo()
    await adicionarComentario(
      id,
      { texto: 'Conferir o print', alvo: 'artigo' },
      ADMIN,
      'Ana',
    )
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'aprovar', ADMIN, { comentario: 'Ok, pode publicar' })
    const cs = await listarComentarios(id)
    expect(cs.map((c) => c.tipo)).toEqual(['comentario', 'aprovacao'])
    await expect(
      adicionarComentario(id, { texto: '  ', alvo: 'artigo' }, ADMIN, 'Ana'),
    ).rejects.toThrow('Escreva')
  })

  it('editar um artigo aprovado anula a aprovação (volta a "em revisão")', async () => {
    const id = await novoArtigo()
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'aprovar', ADMIN)
    await salvarAlteracoes(id, rascunho('mudou'), ADMIN)
    const a = await getArticle(id)
    expect(a?.status).toBe('review')
    expect(a?.aprovadoPor).toBeUndefined()
    expect(a?.titulo).toBe('Título mudou')
    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(
      '"Em revisão"',
    )
  })

  it('arquivar tira da busca; restaurar volta como rascunho; arquivado não se edita', async () => {
    const id = await publicado()
    expect(await indice()).toHaveLength(1)
    await transitar(id, 'arquivar', ADMIN)
    expect((await getArticle(id))?.status).toBe('archived')
    expect(await indice()).toEqual([])
    await expect(salvarAlteracoes(id, rascunho('x'), ADMIN)).rejects.toThrow(
      'Restaure',
    )
    await transitar(id, 'restaurar', ADMIN)
    expect((await getArticle(id))?.status).toBe('draft')
  })

  it('despublicar tira da busca e volta a rascunho', async () => {
    const id = await publicado()
    await transitar(id, 'despublicar', ADMIN)
    expect(await getArticle(id)).toMatchObject({ status: 'draft' })
    expect(await indice()).toEqual([])
  })

  it('a publicação exige texto alternativo em todas as imagens', async () => {
    const id = await novoArtigo()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `articles/${id}`), {
        conteudo: {
          type: 'doc',
          content: [{ type: 'image', attrs: { src: 'x', alt: '' } }],
        },
        status: 'approved',
      })
    })
    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(
      'texto alternativo',
    )
  })
})

describe('artigo publicado: alteração pendente (Emulator)', () => {
  it('editar um publicado não mexe na versão no ar', async () => {
    const id = await publicado('versao um')
    const r = await salvarAlteracoes(id, rascunho('versao dois'), ADMIN)
    expect(r.alvo).toBe('revisao')

    const no_ar = await getArticle(id)
    expect(no_ar).toMatchObject({
      status: 'published',
      versao: 1,
      titulo: 'Título versao um',
    })
    expect(no_ar?.revisao).toMatchObject({ status: 'draft' })
    expect(no_ar?.textoPlano).toContain('versao um')

    const rev = await getRevisao(id)
    expect(rev).toMatchObject({
      titulo: 'Título versao dois',
      status: 'draft',
      baseVersao: 1,
    })
    expect(await indice()).toHaveLength(1)
  })

  it('editar de novo atualiza a mesma alteração (sem criar outra)', async () => {
    const id = await publicado()
    await salvarAlteracoes(id, rascunho('a'), ADMIN)
    await salvarAlteracoes(id, rascunho('b'), ADMIN)
    expect((await getRevisao(id))?.titulo).toBe('Título b')
    const docs = await getDocs(collection(db, `articles/${id}/revisoes`))
    expect(docs.size).toBe(1)
  })

  it('a alteração segue o mesmo ciclo e só vira versão 2 ao ser publicada', async () => {
    const id = await publicado('um')
    await salvarAlteracoes(id, rascunho('dois'), ADMIN)

    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(
      'alteração pendente no estado "Rascunho"',
    )
    await transitar(id, 'enviar', ADMIN)
    expect((await getArticle(id))?.revisao?.status).toBe('review')
    await transitar(id, 'aprovar', ADMIN)
    expect(await getRevisao(id)).toMatchObject({
      status: 'approved',
      aprovadoPor: ADMIN,
    })
    // Até publicar, os leitores continuam vendo a versão 1.
    expect(await getArticle(id)).toMatchObject({
      versao: 1,
      titulo: 'Título um',
      status: 'published',
    })

    const { versao } = await transitar(id, 'publicar', ADMIN)
    expect(versao).toBe(2)
    const depois = await getArticle(id)
    expect(depois).toMatchObject({
      status: 'published',
      versao: 2,
      titulo: 'Título dois',
    })
    expect(depois?.revisao).toBeUndefined()
    expect(await getRevisao(id)).toBeNull()
    expect((await listVersions(id)).map((v) => v.versao)).toEqual([2, 1])
    expect(await indice()).toHaveLength(1)
  })

  it('reprovar a alteração não afeta a versão publicada', async () => {
    const id = await publicado('um')
    await salvarAlteracoes(id, rascunho('dois'), ADMIN)
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'reprovar', ADMIN, { comentario: 'Refazer' })
    expect((await getRevisao(id))?.status).toBe('rejected')
    expect(await getArticle(id)).toMatchObject({
      status: 'published',
      versao: 1,
      titulo: 'Título um',
    })
    const cs = await listarComentarios(id)
    expect(cs[0]).toMatchObject({ tipo: 'reprovacao', alvo: 'revisao' })
  })

  it('editar uma alteração aprovada anula a aprovação', async () => {
    const id = await publicado()
    await salvarAlteracoes(id, rascunho('a'), ADMIN)
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'aprovar', ADMIN)
    await salvarAlteracoes(id, rascunho('b'), ADMIN)
    expect((await getRevisao(id))?.status).toBe('review')
  })

  it('com alteração pendente não dá para arquivar nem despublicar; descartar libera', async () => {
    const id = await publicado()
    await salvarAlteracoes(id, rascunho('a'), ADMIN)
    await expect(transitar(id, 'arquivar', ADMIN)).rejects.toThrow(
      'alteração pendente',
    )
    await expect(transitar(id, 'despublicar', ADMIN)).rejects.toThrow(
      'alteração pendente',
    )

    await descartarRevisao(id, ADMIN)
    expect(await getRevisao(id)).toBeNull()
    expect((await getArticle(id))?.revisao).toBeUndefined()
    await expect(descartarRevisao(id, ADMIN)).rejects.toThrow(
      'Não há alteração pendente',
    )
    await expect(transitar(id, 'arquivar', ADMIN)).resolves.toBeDefined()
  })

  it('a alteração vinda de uma sugestão marca a sugestão como aprovada ao publicar', async () => {
    const id = await publicado('um')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `articles/${id}/suggestions/s1`), {
        status: 'pending',
      })
    })
    await salvarAlteracoes(id, rascunho('da sugestão'), ADMIN, {
      sugestaoId: 's1',
    })
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'aprovar', ADMIN)
    await transitar(id, 'publicar', ADMIN)
    const s = (await getDoc(doc(db, `articles/${id}/suggestions/s1`))).data()
    expect(s).toMatchObject({ status: 'approved', decididoPor: ADMIN })
    expect((await listVersions(id))[0]?.origem).toBe('ia')
  })
})

describe('aprovar sugestão direto (Emulator)', () => {
  it('publica como nova versão e aprova a sugestão, só para artigo publicado', async () => {
    const id = await publicado('um')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `articles/${id}/suggestions/s1`), {
        status: 'pending',
      })
    })
    const v = await aprovarSugestao(id, rascunho('sugerido'), ADMIN, 's1')
    expect(v).toBe(2)
    expect(await getArticle(id)).toMatchObject({
      versao: 2,
      titulo: 'Título sugerido',
      aprovadoPor: ADMIN,
    })
    expect(
      (await getDoc(doc(db, `articles/${id}/suggestions/s1`))).get('status'),
    ).toBe('approved')

    const rascunhoId = await novoArtigo()
    await expect(
      aprovarSugestao(rascunhoId, rascunho('x'), ADMIN, 's1'),
    ).rejects.toThrow('artigo publicado')
  })

  it('não passa por cima de uma alteração pendente', async () => {
    const id = await publicado()
    await salvarAlteracoes(id, rascunho('a'), ADMIN)
    await expect(
      aprovarSugestao(id, rascunho('b'), ADMIN, 's1'),
    ).rejects.toThrow('alteração pendente')
  })
})

describe('excluir artigo (Emulator)', () => {
  it('leva junto versões, comentários e a alteração pendente, e sai da busca', async () => {
    const id = await publicado()
    await salvarAlteracoes(id, rascunho('a'), ADMIN)
    await adicionarComentario(id, { texto: 'x', alvo: 'artigo' }, ADMIN, 'Ana')
    await deleteArticle(id, ADMIN)
    expect(await getArticle(id)).toBeNull()
    expect(
      (
        await getDocs(
          query(
            collection(db, `articles/${id}/comentarios`),
            orderBy('criadoEm'),
          ),
        )
      ).size,
    ).toBe(0)
    expect(await getRevisao(id)).toBeNull()
    expect(await listVersions(id)).toEqual([])
    expect(await indice()).toEqual([])
  })
})

describe('modelos por preencher (Emulator)', () => {
  const comModelo = (t: string) => rascunho(`[Preencher: ${t}]`)
  const mensagem = 'Ainda há 1 trecho do modelo para preencher'

  it('não deixa enviar para revisão com trecho do modelo sem preencher', async () => {
    const id = await createArticle(comModelo('explique'), 'p1', 'p1', ADMIN)
    await expect(transitar(id, 'enviar', ADMIN)).rejects.toThrow(mensagem)
    expect((await getArticle(id))?.status).toBe('draft')

    await salvarAlteracoes(id, rascunho('texto de verdade'), ADMIN)
    await expect(transitar(id, 'enviar', ADMIN)).resolves.toBeDefined()
    expect((await getArticle(id))?.status).toBe('review')
  })

  it('também barra a publicação, mesmo que o conteúdo tenha chegado por outro caminho', async () => {
    const id = await novoArtigo('ok')
    await transitar(id, 'enviar', ADMIN)
    await transitar(id, 'aprovar', ADMIN)
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), `articles/${id}`), {
        conteudo: texto('[Preencher: ficou]'),
      })
    })
    await expect(transitar(id, 'publicar', ADMIN)).rejects.toThrow(mensagem)
    expect((await getArticle(id))?.status).toBe('approved')
  })

  it('vale também para a alteração pendente de um artigo publicado', async () => {
    const id = await publicado('um')
    await salvarAlteracoes(id, comModelo('novo trecho'), ADMIN)
    await expect(transitar(id, 'enviar', ADMIN)).rejects.toThrow(mensagem)
    expect((await getRevisao(id))?.status).toBe('draft')
    await expect(transitar(id, 'arquivar', ADMIN)).rejects.toThrow(
      'alteração pendente',
    )
  })

  it('ações que não levam para o ar (como comentar ou reprovar) não são travadas', async () => {
    const id = await novoArtigo('ok')
    await transitar(id, 'enviar', ADMIN)
    await salvarAlteracoes(id, comModelo('editado depois'), ADMIN)
    await expect(
      transitar(id, 'reprovar', ADMIN, { comentario: 'ajustar' }),
    ).resolves.toBeDefined()
  })
})
