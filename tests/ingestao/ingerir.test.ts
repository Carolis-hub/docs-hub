import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ingerir, type OpcoesIngestao } from '../../scripts/ingestao/ingerir'
import { criarResolvedorImagens } from '../../scripts/migrate/images'

const db = () =>
  getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-docs-hub' }))

let pasta: string
const escrever = async (rel: string, texto: string) => {
  await mkdir(path.dirname(path.join(pasta, rel)), { recursive: true })
  await writeFile(path.join(pasta, rel), texto)
}

const AGORA = 1_700_000_000_000
const opcoes = (extra: Partial<OpcoesIngestao> = {}): OpcoesIngestao => ({
  pasta,
  produto: 'SmartShare DI',
  fonte: 'di-docs',
  gravar: true,
  autorId: 'ingestao',
  agora: AGORA,
  resolverImagem: criarResolvedorImagens({
    baseDir: pasta,
    cache: new Map(),
    pular: true,
    cloudinary: null,
  }),
  ...extra,
})

const artigos = async () =>
  (await db().collection('articles').get()).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }))
const porTitulo = async (titulo: string) => {
  const a = (await artigos()).find(
    (x) => (x as { titulo?: string }).titulo === titulo,
  )
  if (!a) throw new Error(`artigo "${titulo}" não existe`)
  return a as Record<string, unknown> & { id: string }
}

const CONFIG =
  '# Configurar o e-mail\n\nPasso a passo para configurar e habilitar o envio.\n'

beforeAll(async () => {
  pasta = await mkdtemp(path.join(tmpdir(), 'ingestao-it-'))
})
afterAll(() => rm(pasta, { recursive: true, force: true }))

beforeEach(async () => {
  await fetch(
    'http://127.0.0.1:8080/emulator/v1/projects/demo-docs-hub/databases/(default)/documents',
    { method: 'DELETE' },
  )
  await rm(pasta, { recursive: true, force: true })
  await mkdir(pasta, { recursive: true })
  await db().doc('blocks/p-di').set({
    nome: 'SmartShare DI',
    slug: 'smartshare-di',
    parentId: null,
    productId: 'p-di',
  })
  await escrever(
    'visao-geral.md',
    '# Visão geral\n\nO produto permite consultar documentos.\n',
  )
  await escrever('config/email.md', CONFIG)
  await escrever('config/outra-copia.md', CONFIG)
  await escrever('notas.txt', 'Notas do projeto\n\nPrimeira linha.')
  await escrever('manual.pdf', 'pdf')
})

describe('ingestão de arquivos (Emulator)', () => {
  it('simulação não grava nada, mas relata o que faria', async () => {
    const r = await ingerir(db(), opcoes({ gravar: false }))
    expect(r.contagem).toMatchObject({ novo: 3, duplicado: 1, ignorado: 1 })
    expect((await artigos()).length).toBe(0)
    expect((await db().collection('fontes').get()).size).toBe(0)
    expect((await db().collection('blocks').get()).size).toBe(1)
  })

  it('cria tudo na fila de revisão, com origem e classificação, e nada publicado', async () => {
    const r = await ingerir(db(), opcoes())
    expect(r.contagem).toMatchObject({
      novo: 3,
      duplicado: 1,
      ignorado: 1,
      erro: 0,
    })

    const todos = await artigos()
    expect(todos).toHaveLength(3)
    expect(
      todos.every((a) => (a as { status?: string }).status === 'review'),
    ).toBe(true)

    const config = await porTitulo('Configurar o e-mail')
    expect(config).toMatchObject({
      status: 'review',
      versao: 0,
      productId: 'p-di',
      categoria: 'configuracoes',
      publico: 'usuario',
      autorId: 'ingestao',
      origem: {
        tipo: 'importacao',
        fonte: 'di-docs',
        arquivo: 'config/email.md',
      },
    })
    // A pasta "config" virou um subproduto dentro do produto.
    const blocoConfig = (await db().collection('blocks').get()).docs.find(
      (d) => d.get('nome') === 'Config',
    )
    expect(blocoConfig?.get('parentId')).toBe('p-di')
    expect(config.blockId).toBe(blocoConfig?.id)
    expect(blocoConfig?.get('productId')).toBe('p-di')

    // Nada de índice de busca: só o publicado entra nele.
    expect((await db().collection('searchIndex').get()).size).toBe(0)

    const fontes = (await db().collection('fontes').get()).docs.map((d) =>
      d.data(),
    )
    expect(
      fontes.find((f) => f.caminho === 'config/outra-copia.md'),
    ).toMatchObject({
      status: 'duplicado',
      duplicadoDe: 'config/email.md',
    })
    expect(fontes.find((f) => f.caminho === 'config/email.md')).toMatchObject({
      status: 'ativo',
      artigoId: config.id,
    })
    expect(fontes.find((f) => f.caminho === 'manual.pdf')).toBeUndefined()
    expect(r.arquivos.find((a) => a.caminho === 'manual.pdf')).toMatchObject({
      estado: 'ignorado',
    })
  })

  it('rodar de novo sem mudanças não reprocessa nem altera nada', async () => {
    await ingerir(db(), opcoes())
    const antes = JSON.stringify(await artigos())
    const r = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(r.contagem).toMatchObject({
      novo: 0,
      alterado: 0,
      'sem-alteracao': 3,
      duplicado: 1,
    })
    expect(JSON.stringify(await artigos())).toBe(antes)
  })

  it('arquivo alterado cujo artigo ainda está na fila atualiza o item da fila', async () => {
    await ingerir(db(), opcoes())
    await escrever('visao-geral.md', '# Visão geral\n\nTexto novo e melhor.\n')
    const r = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(r.contagem.alterado).toBe(1)
    expect(r.arquivos.find((a) => a.estado === 'alterado')?.destino).toBe(
      'atualizado-na-fila',
    )
    const a = await porTitulo('Visão geral')
    expect(a.textoPlano).toContain('Texto novo e melhor')
    expect(a.status).toBe('review')
  })

  it('arquivo alterado de um artigo publicado vira sugestão e a versão publicada continua', async () => {
    await ingerir(db(), opcoes())
    const antes = await porTitulo('Visão geral')
    // Um admin aprovou e publicou.
    await db().doc(`articles/${antes.id}`).update({
      status: 'published',
      versao: 1,
      atualizadoPor: 'admin',
    })

    await escrever(
      'visao-geral.md',
      '# Visão geral\n\nO produto agora faz mais coisas.\n',
    )
    const r = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(r.arquivos.find((a) => a.estado === 'alterado')?.destino).toBe(
      'revisao-pendente',
    )

    const depois = await porTitulo('Visão geral')
    expect(depois.status).toBe('published')
    expect(depois.textoPlano).toBe(antes.textoPlano)

    const sugestoes = (
      await db().collection(`articles/${antes.id}/suggestions`).get()
    ).docs.map((d) => d.data())
    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]).toMatchObject({
      status: 'pending',
      origem: { tipo: 'ingestao', arquivo: 'visao-geral.md' },
      baseVersao: 1,
    })
    expect(sugestoes[0]?.textoPlano).toContain('faz mais coisas')
    expect((sugestoes[0]?.diffResumo as string[]).length).toBeGreaterThan(0)

    // Mesma versão do arquivo: não cria outra sugestão.
    const igual = await ingerir(db(), opcoes({ agora: AGORA + 2000 }))
    expect(igual.contagem.alterado).toBe(0)

    // Uma terceira versão descarta a sugestão pendente anterior.
    await escrever(
      'visao-geral.md',
      '# Visão geral\n\nTerceira versão do texto.\n',
    )
    await ingerir(db(), opcoes({ agora: AGORA + 3000 }))
    const todas = (
      await db().collection(`articles/${antes.id}/suggestions`).get()
    ).docs
    expect(todas).toHaveLength(2)
    expect(todas.filter((s) => s.get('status') === 'pending')).toHaveLength(1)
    expect(todas.filter((s) => s.get('status') === 'discarded')).toHaveLength(1)
  })

  it('um artigo editado por uma pessoa também recebe sugestão, não é sobrescrito', async () => {
    await ingerir(db(), opcoes())
    const a = await porTitulo('Visão geral')
    await db().doc(`articles/${a.id}`).update({ atualizadoPor: 'maria' })
    await escrever(
      'visao-geral.md',
      '# Visão geral\n\nOutro texto vindo do arquivo.\n',
    )
    const r = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(r.arquivos.find((x) => x.estado === 'alterado')?.destino).toBe(
      'revisao-pendente',
    )
    expect((await porTitulo('Visão geral')).textoPlano).toBe(a.textoPlano)
  })

  it('arquivo removido marca o artigo para análise, sem despublicar; ao voltar, a marca sai', async () => {
    await ingerir(db(), opcoes())
    const a = await porTitulo('Visão geral')
    await db()
      .doc(`articles/${a.id}`)
      .update({ status: 'published', versao: 1, atualizadoPor: 'admin' })

    const conteudo =
      '# Visão geral\n\nO produto permite consultar documentos.\n'
    await unlink(path.join(pasta, 'visao-geral.md'))
    const r = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(r.contagem.removido).toBe(1)
    const marcado = await porTitulo('Visão geral')
    expect(marcado.status).toBe('published')
    expect(marcado.flags).toContain('origem_removida')

    // Rodar de novo não repete o aviso.
    expect(
      (await ingerir(db(), opcoes({ agora: AGORA + 2000 }))).contagem.removido,
    ).toBe(0)

    await escrever('visao-geral.md', conteudo)
    const volta = await ingerir(db(), opcoes({ agora: AGORA + 3000 }))
    expect(volta.contagem.reapareceu).toBe(1)
    expect((await porTitulo('Visão geral')).flags).not.toContain(
      'origem_removida',
    )
  })

  it('erro de processamento fica registrado e é refeito na rodada seguinte', async () => {
    await escrever('quebra.md', '# Com imagem\n\n![x](imagens/quebra.png)\n')
    const imagemQuebrada = async (src: string) => {
      if (src.includes('quebra.png')) throw new Error('falha ao ler a imagem')
      return { url: src }
    }
    const r = await ingerir(db(), opcoes({ resolverImagem: imagemQuebrada }))
    expect(r.contagem.erro).toBe(1)
    expect(r.arquivos.find((a) => a.estado === 'erro')?.detalhe).toContain(
      'falha ao ler a imagem',
    )
    expect(
      (await artigos()).find(
        (x) => (x as { titulo?: string }).titulo === 'Com imagem',
      ),
    ).toBeUndefined()
    const reg = (await db().collection('fontes').get()).docs.find(
      (d) => d.get('caminho') === 'quebra.md',
    )
    expect(reg?.get('status')).toBe('erro')

    const de_novo = await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    expect(de_novo.contagem).toMatchObject({ erro: 0, novo: 1 })
    expect(await porTitulo('Com imagem')).toMatchObject({ status: 'review' })
  })

  it('conteúdo técnico entra restrito ao público técnico', async () => {
    await escrever(
      'api.md',
      '# Chamando a API\n\nUse o endpoint REST com token.\n\n```json\n{"a":1}\n```\n\n```sql\nselect 1\n```\n\nO log do servidor mostra o stack trace.\n',
    )
    await ingerir(db(), opcoes())
    expect(await porTitulo('Chamando a API')).toMatchObject({
      publico: 'tecnico',
    })
  })

  it('falha com mensagem clara se o produto não existe', async () => {
    await expect(
      ingerir(db(), opcoes({ produto: 'Inexistente' })),
    ).rejects.toThrow('Produto "Inexistente" não encontrado')
  })
})

describe('painel de sincronização: resumo da rodada (Emulator)', () => {
  const resumoDaFonte = async () =>
    (await db().doc('sincronizacoes/di-docs').get()).data()!

  it('grava o resumo da rodada com produto, modo, contagens e duração', async () => {
    await ingerir(db(), opcoes({ modo: 'observar' }))
    const r = await resumoDaFonte()
    expect(r).toMatchObject({
      fonteId: 'di-docs',
      produtoId: 'p-di',
      produtoNome: 'SmartShare DI',
      ultimaExecucao: AGORA,
      ultimaMudanca: AGORA,
      modo: 'observar',
      repo: null,
      commit: null,
      resumo: { novo: 3, duplicado: 1, ignorado: 1, erro: 0 },
      erros: [],
      removidos: [],
    })
    expect(r.duracaoMs).toBeGreaterThanOrEqual(0)
  })

  it('o modo padrão é "manual", e a simulação não grava nada', async () => {
    await ingerir(db(), opcoes({ gravar: false }))
    expect((await db().doc('sincronizacoes/di-docs').get()).exists).toBe(false)
    await ingerir(db(), opcoes())
    expect((await resumoDaFonte()).modo).toBe('manual')
  })

  it('rodada sem novidade atualiza a hora da conferência e mantém a data da última mudança', async () => {
    await ingerir(db(), opcoes())
    await ingerir(db(), opcoes({ agora: AGORA + 60_000 }))
    const r = await resumoDaFonte()
    expect(r.ultimaExecucao).toBe(AGORA + 60_000)
    expect(r.ultimaMudanca).toBe(AGORA)
    expect(r.resumo).toMatchObject({ novo: 0, 'sem-alteracao': 3 })

    await escrever('visao-geral.md', '# Visão geral\n\nMudou.\n')
    await ingerir(db(), opcoes({ agora: AGORA + 120_000 }))
    expect((await resumoDaFonte()).ultimaMudanca).toBe(AGORA + 120_000)
  })

  it('guarda os erros (com o motivo) e os arquivos removidos', async () => {
    await escrever('quebra.md', '# Com imagem\n\n![x](imagens/quebra.png)\n')
    const imagemQuebrada = async (src: string) => {
      if (src.includes('quebra.png')) throw new Error('falha ao ler a imagem')
      return { url: src }
    }
    await ingerir(db(), opcoes({ resolverImagem: imagemQuebrada }))
    let r = await resumoDaFonte()
    expect(r.erros).toEqual([
      {
        caminho: 'quebra.md',
        detalhe: expect.stringContaining('falha ao ler a imagem'),
      },
    ])
    expect(r.resumo.erro).toBe(1)

    await unlink(path.join(pasta, 'quebra.md'))
    await unlink(path.join(pasta, 'notas.txt'))
    await ingerir(db(), opcoes({ agora: AGORA + 1000 }))
    r = await resumoDaFonte()
    expect(r.removidos).toEqual(['notas.txt'])
    expect(r.erros).toEqual([])
  })

  it('registra repositório e commit no resumo, nos artigos e nas sugestões', async () => {
    await ingerir(
      db(),
      opcoes({ modo: 'git', repo: 'org/docs', commit: 'abc1234' }),
    )
    const r = await resumoDaFonte()
    expect(r).toMatchObject({
      modo: 'git',
      repo: 'org/docs',
      commit: 'abc1234',
    })
    const a = await porTitulo('Visão geral')
    expect(a.origem).toMatchObject({ repo: 'org/docs', commit: 'abc1234' })

    await db()
      .doc(`articles/${a.id}`)
      .update({ status: 'published', versao: 1, atualizadoPor: 'admin' })
    await escrever('visao-geral.md', '# Visão geral\n\nNova versão.\n')
    await ingerir(
      db(),
      opcoes({
        agora: AGORA + 1000,
        modo: 'git',
        repo: 'org/docs',
        commit: 'def5678',
      }),
    )
    const sugestoes = await db()
      .collection(`articles/${a.id}/suggestions`)
      .get()
    expect(sugestoes.docs[0]!.get('origem')).toMatchObject({
      tipo: 'ingestao',
      repo: 'org/docs',
      commit: 'def5678',
    })
  })
})
