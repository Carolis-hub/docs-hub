import { getApps, initializeApp } from 'firebase-admin/app'
import {
  getFirestore,
  initializeFirestore,
  type DocumentReference,
} from 'firebase-admin/firestore'
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
  /**
   * Usa REST (HTTP comum) em vez de gRPC. Ajuda em redes de empresa com proxy
   * ou firewall que travam o gRPC (erro DEADLINE_EXCEEDED).
   */
  rest?: boolean
}

export interface ResultadoGravacao {
  blocosGravados: number
  blocosPulados: number
  artigosGravados: number
  artigosPulados: number
  indices: number
  /** Versões do histórico recriadas em artigos que já existiam sem elas. */
  versoesRecriadas: number
}

/** Códigos do Firestore que valem uma nova tentativa (rede lenta ou instável). */
const CODIGOS_TRANSITORIOS = new Set([
  4, // DEADLINE_EXCEEDED
  8, // RESOURCE_EXHAUSTED
  10, // ABORTED
  14, // UNAVAILABLE
])
export const MAX_TENTATIVAS = 8

export function deveTentarDeNovo(
  codigo: number,
  tentativasFeitas: number,
): boolean {
  return CODIGOS_TRANSITORIOS.has(codigo) && tentativasFeitas < MAX_TENTATIVAS
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
  const db = opts.rest
    ? initializeFirestore(app, { preferRest: true })
    : getFirestore(app)
  const resultado: ResultadoGravacao = {
    blocosGravados: 0,
    blocosPulados: 0,
    artigosGravados: 0,
    artigosPulados: 0,
    indices: 0,
    versoesRecriadas: 0,
  }

  const refsBlocos = plano.blocos.map((b) => db.collection('blocks').doc(b.id))
  const refsArtigos = plano.artigos.map((a) =>
    db.collection('articles').doc(a.id),
  )
  const existentes = await lerTodos([...refsBlocos, ...refsArtigos])
  const writer = db.bulkWriter()
  // Falhas de rede são tentadas de novo; as que esgotam as tentativas entram
  // em `falhas` e viram um erro curto no fim, em vez de derrubar o processo.
  const falhas: string[] = []
  writer.onWriteError((erro) => {
    if (deveTentarDeNovo(erro.code, erro.failedAttempts)) return true
    falhas.push(`${erro.documentRef.path}: ${erro.message.split('\n')[0]}`)
    return false
  })
  const escrever = (ref: DocumentReference, dados: Record<string, unknown>) => {
    writer.set(ref, dados).catch(() => undefined)
  }

  plano.blocos.forEach((b, i) => {
    const ref = refsBlocos[i] as DocumentReference
    if (existentes.get(ref.path) && !opts.sobrescrever) {
      resultado.blocosPulados++
      return
    }
    const dados: Omit<Block, 'id'> & { id?: string } = { ...b }
    delete dados.id
    escrever(ref, dados as Record<string, unknown>)
    resultado.blocosGravados++
  })

  // Itens do índice de busca: os recém-gravados e os publicados que já existiam
  // (assim uma segunda rodada, depois de uma queda no meio, completa o índice).
  const itensPorProduto = new Map<string, SearchItem[]>()
  const guardarItem = (productId: string, item: SearchItem) => {
    const lista = itensPorProduto.get(productId) ?? []
    lista.push(item)
    itensPorProduto.set(productId, lista)
  }
  const puladosPublicados: Array<{
    ref: DocumentReference
    anterior: FirebaseFirestore.DocumentData
  }> = []
  plano.artigos.forEach((a, i) => {
    const ref = refsArtigos[i] as DocumentReference
    const anterior = existentes.get(ref.path)
    if (anterior && !opts.sobrescrever) {
      resultado.artigosPulados++
      if (anterior.status === 'published') {
        puladosPublicados.push({ ref, anterior })
        guardarItem(
          a.productId,
          itemDoArtigo({ ...(anterior as Article), id: a.id }),
        )
      }
      return
    }
    const dados: Omit<Article, 'id'> & { id?: string } = { ...a }
    delete dados.id
    const publicado = a.status === 'published'
    const versaoAnterior = (anterior?.versao as number | undefined) ?? 0
    const versao = publicado ? versaoAnterior + 1 : versaoAnterior
    escrever(ref, {
      ...dados,
      versao,
      views: (anterior?.views as number | undefined) ?? 0,
      criadoEm: (anterior?.criadoEm as number | undefined) ?? dados.criadoEm,
    })
    if (publicado) {
      escrever(ref.collection('versions').doc(String(versao)), {
        versao,
        titulo: a.titulo,
        conteudo: a.conteudo,
        origem: 'manual',
        autorId: opts.autorId,
        criadoEm: a.atualizadoEm,
      })
      guardarItem(a.productId, itemDoArtigo(a))
    }
    resultado.artigosGravados++
  })

  // Uma queda no meio da gravação pode deixar um artigo sem o registro da
  // sua versão no histórico (são escritas separadas): recria o que faltar.
  const comVersao = puladosPublicados.filter(
    (p) => ((p.anterior.versao as number | undefined) ?? 0) >= 1,
  )
  const refsVersoes = comVersao.map((p) =>
    p.ref.collection('versions').doc(String(p.anterior.versao)),
  )
  const versoesExistentes = await lerTodos(refsVersoes)
  comVersao.forEach((p, i) => {
    const refVersao = refsVersoes[i] as DocumentReference
    if (versoesExistentes.get(refVersao.path)) return
    resultado.versoesRecriadas++
    escrever(refVersao, {
      versao: p.anterior.versao,
      titulo: p.anterior.titulo,
      conteudo: p.anterior.conteudo,
      origem: 'manual',
      autorId: opts.autorId,
      criadoEm: p.anterior.atualizadoEm,
    })
  })

  // Índice de busca: une o que já existe com os artigos recém-publicados.
  for (const [productId, novos] of itensPorProduto) {
    const refIndice = db.collection('searchIndex').doc(productId)
    const principal = await refIndice.get()
    const dados = principal.data() as
      { itens?: SearchItem[]; dividido?: boolean } | undefined
    let itens = dados?.itens ?? []
    if (dados?.dividido) {
      const partes = await refIndice.collection('partes').get()
      itens = partes.docs.flatMap((p) => (p.data().itens as SearchItem[]) ?? [])
    }
    const ids = new Set(novos.map((i) => i.id))
    const uniao = [...itens.filter((i) => !ids.has(i.id)), ...novos]

    const arvoreSnap = await db
      .collection('blocks')
      .where('productId', '==', productId)
      .get()
    const arvore = [
      ...arvoreSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Block),
      ...plano.blocos.filter((b) => b.productId === productId),
    ]
    const indice = montarIndice(uniao, arvore)
    escrever(refIndice, indice.principal)
    for (const [parteId, lista] of Object.entries(indice.partes)) {
      escrever(refIndice.collection('partes').doc(parteId), {
        itens: lista,
      })
    }
    resultado.indices++
  }

  escrever(db.collection('auditLog').doc(), {
    usuarioId: opts.autorId,
    acao: 'migracao.importar',
    alvo: `articles (${resultado.artigosGravados}) / blocks (${resultado.blocosGravados})`,
    data: opts.agora,
  })
  await writer.close()
  if (falhas.length > 0) {
    throw new Error(
      `${falhas.length} escrita(s) falharam depois de ${MAX_TENTATIVAS} tentativas. ` +
        `Nada foi perdido: rode o mesmo comando de novo, que ele pula o que já foi gravado.\n` +
        `  Primeira falha: ${falhas[0]}\n` +
        `  Se for DEADLINE_EXCEEDED ou UNAVAILABLE, é a rede: tente a opção --rest, ` +
        `desligue a VPN ou use outra conexão.`,
    )
  }
  return resultado
}
