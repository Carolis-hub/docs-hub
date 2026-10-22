import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore'
import type { Article, Block } from '../../src/types/content.ts'
import type { SearchItem } from '../../src/types/search.ts'
import { itemDoArtigo, montarIndice } from '../../src/utils/searchIndex.ts'
import type { Plano } from './types.ts'

export interface GravarOpts {
  projectId: string
  /** Substitui conteúdo já existente com o mesmo id (mantém `views`). */
  sobrescrever: boolean
  autorId: string
  agora: number
}

export interface ResultadoGravacao {
  blocosGravados: number
  blocosPulados: number
  artigosGravados: number
  artigosPulados: number
  indices: number
}

async function lerTodos(refs: DocumentReference[]) {
  const mapa = new Map<string, FirebaseFirestore.DocumentData | undefined>()
  for (let i = 0; i < refs.length; i += 300) {
    const lote = refs.slice(i, i + 300)
    const snaps = await lote[0]?.firestore.getAll(...lote)
    snaps?.forEach((s) => mapa.set(s.ref.path, s.exists ? s.data() : undefined))
  }
  return mapa
}

/**
 * Grava o plano com o Admin SDK (ignora as regras de segurança). Usa as
 * credenciais padrão do Google, ou o Emulator se `FIRESTORE_EMULATOR_HOST`
 * estiver definido.
 */
export async function gravar(
  plano: Plano,
  opts: GravarOpts,
): Promise<ResultadoGravacao> {
  const app = getApps()[0] ?? initializeApp({ projectId: opts.projectId })
  const db = getFirestore(app)
  const resultado: ResultadoGravacao = {
    blocosGravados: 0,
    blocosPulados: 0,
    artigosGravados: 0,
    artigosPulados: 0,
    indices: 0,
  }

  const refsBlocos = plano.blocos.map((b) => db.collection('blocks').doc(b.id))
  const refsArtigos = plano.artigos.map((a) =>
    db.collection('articles').doc(a.id),
  )
  const existentes = await lerTodos([...refsBlocos, ...refsArtigos])
  const writer = db.bulkWriter()

  plano.blocos.forEach((b, i) => {
    const ref = refsBlocos[i] as DocumentReference
    if (existentes.get(ref.path) && !opts.sobrescrever) {
      resultado.blocosPulados++
      return
    }
    const dados: Omit<Block, 'id'> & { id?: string } = { ...b }
    delete dados.id
    void writer.set(ref, dados)
    resultado.blocosGravados++
  })

  const novosPorProduto = new Map<string, Article[]>()
  plano.artigos.forEach((a, i) => {
    const ref = refsArtigos[i] as DocumentReference
    const anterior = existentes.get(ref.path)
    if (anterior && !opts.sobrescrever) {
      resultado.artigosPulados++
      return
    }
    const dados: Omit<Article, 'id'> & { id?: string } = { ...a }
    delete dados.id
    const publicado = a.status === 'published'
    const versaoAnterior = (anterior?.versao as number | undefined) ?? 0
    const versao = publicado ? versaoAnterior + 1 : versaoAnterior
    void writer.set(ref, {
      ...dados,
      versao,
      views: (anterior?.views as number | undefined) ?? 0,
      criadoEm: (anterior?.criadoEm as number | undefined) ?? dados.criadoEm,
    })
    if (publicado) {
      void writer.set(ref.collection('versions').doc(String(versao)), {
        versao,
        titulo: a.titulo,
        conteudo: a.conteudo,
        origem: 'manual',
        autorId: opts.autorId,
        criadoEm: a.atualizadoEm,
      })
      const lista = novosPorProduto.get(a.productId) ?? []
      lista.push(a)
      novosPorProduto.set(a.productId, lista)
    }
    resultado.artigosGravados++
  })

  // Índice de busca: une o que já existe com os artigos recém-publicados.
  for (const [productId, novos] of novosPorProduto) {
    const refIndice = db.collection('searchIndex').doc(productId)
    const principal = await refIndice.get()
    const dados = principal.data() as
      { itens?: SearchItem[]; dividido?: boolean } | undefined
    let itens = dados?.itens ?? []
    if (dados?.dividido) {
      const partes = await refIndice.collection('partes').get()
      itens = partes.docs.flatMap((p) => (p.data().itens as SearchItem[]) ?? [])
    }
    const ids = new Set(novos.map((a) => a.id))
    const uniao = [
      ...itens.filter((i) => !ids.has(i.id)),
      ...novos.map(itemDoArtigo),
    ]

    const arvoreSnap = await db
      .collection('blocks')
      .where('productId', '==', productId)
      .get()
    const arvore = [
      ...arvoreSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Block),
      ...plano.blocos.filter((b) => b.productId === productId),
    ]
    const indice = montarIndice(uniao, arvore)
    void writer.set(refIndice, indice.principal)
    for (const [parteId, lista] of Object.entries(indice.partes)) {
      void writer.set(refIndice.collection('partes').doc(parteId), {
        itens: lista,
      })
    }
    resultado.indices++
  }

  void writer.set(db.collection('auditLog').doc(), {
    usuarioId: opts.autorId,
    acao: 'migracao.importar',
    alvo: `articles (${resultado.artigosGravados}) / blocks (${resultado.blocosGravados})`,
    data: opts.agora,
  })
  await writer.close()
  return resultado
}
