import {
  collection,
  deleteField,
  doc,
  getDoc,
  runTransaction,
} from 'firebase/firestore'
import type {
  ArticleDraft,
  ArticleVersion,
  Comentario,
  Revisao,
  RevisaoStatus,
} from '../types/content'
import {
  proximoEstado,
  ROTULOS_STATUS,
  rotuloDaAcao,
  exigeComentario,
  type AcaoCiclo,
  type EstadoCiclo,
} from '../utils/ciclo'
import { imagensSemAlt } from '../utils/content'
import { slugify } from '../utils/slug'
import { registrarAuditoria, type AuditAction } from './audit'
import { camposDerivados, fromSnap, validar } from './articles'
import { db } from './firebase'
import { invalidarCacheBusca } from './search'
import { atualizarIndiceTx, itemDoArtigo } from './searchIndex'

const artigoRef = (id: string) => doc(db, 'articles', id)
const revisaoRef = (id: string) => doc(db, 'articles', id, 'revisoes', 'atual')

const ACOES_DO_ARTIGO: AcaoCiclo[] = ['despublicar', 'arquivar', 'restaurar']

const AUDITORIA: Record<AcaoCiclo, AuditAction> = {
  enviar: 'artigo.enviar-revisao',
  aprovar: 'artigo.aprovar',
  reprovar: 'artigo.reprovar',
  reabrir: 'artigo.devolver-rascunho',
  publicar: 'artigo.publicar',
  despublicar: 'artigo.despublicar',
  arquivar: 'artigo.arquivar',
  restaurar: 'artigo.restaurar',
}

export async function getRevisao(articleId: string): Promise<Revisao | null> {
  const snap = await getDoc(revisaoRef(articleId))
  return snap.exists() ? (snap.data() as Revisao) : null
}

export interface OpcoesTransicao {
  /** Obrigatório ao reprovar; nas outras ações vira um comentário de revisão. */
  comentario?: string
  autorNome?: string
  /** Sugestão a marcar como aprovada ao publicar. */
  sugestaoId?: string
}

/**
 * Aplica uma ação do ciclo de vida. Num artigo publicado com alteração
 * pendente, as ações de revisão (enviar, aprovar, reprovar, reabrir, publicar)
 * valem para a ALTERAÇÃO, e a versão publicada só muda quando ela é
 * publicada. Tudo acontece numa transação, com a trilha de auditoria.
 */
export async function transitar(
  articleId: string,
  acao: AcaoCiclo,
  uid: string,
  opcoes: OpcoesTransicao = {},
): Promise<{ versao?: number }> {
  const comentario = opcoes.comentario?.trim() ?? ''
  if (exigeComentario(acao) && !comentario) {
    throw new Error('Explique o que precisa ser ajustado antes de reprovar.')
  }
  let versaoPublicada: number | undefined

  await runTransaction(db, async (tx) => {
    // Todas as leituras antes de qualquer escrita (regra das transações).
    const snapArtigo = await tx.get(artigoRef(articleId))
    if (!snapArtigo.exists()) throw new Error('Artigo não encontrado.')
    const artigo = fromSnap(snapArtigo)
    const comAlteracao = artigo.status === 'published' && !!artigo.revisao
    if (comAlteracao && ACOES_DO_ARTIGO.includes(acao)) {
      throw new Error(
        `Há uma alteração pendente neste artigo. Publique-a ou descarte-a antes de ${rotuloDaAcao(acao).toLowerCase()}.`,
      )
    }
    const snapRevisao = comAlteracao
      ? await tx.get(revisaoRef(articleId))
      : null
    const revisao = snapRevisao?.exists()
      ? (snapRevisao.data() as Revisao)
      : null
    if (comAlteracao && !revisao) {
      throw new Error(
        'A alteração pendente não foi encontrada. Atualize a página.',
      )
    }
    const naRevisao = comAlteracao
    const estado: EstadoCiclo = naRevisao
      ? (revisao as Revisao).status
      : artigo.status
    const novo = proximoEstado(estado, acao)
    if (!novo) {
      throw new Error(
        `"${rotuloDaAcao(acao)}" não vale para ${naRevisao ? 'a alteração pendente' : 'o artigo'} no estado "${ROTULOS_STATUS[estado]}".`,
      )
    }
    const sugestaoId = naRevisao ? revisao?.sugestaoId : opcoes.sugestaoId
    const refSugestao = sugestaoId
      ? doc(db, 'articles', articleId, 'suggestions', sugestaoId)
      : null
    const snapSugestao =
      acao === 'publicar' && refSugestao ? await tx.get(refSugestao) : null

    const agora = Date.now()
    const trabalho = naRevisao ? (revisao as Revisao) : artigo

    if (acao === 'publicar') {
      if (imagensSemAlt(trabalho.conteudo) > 0) {
        throw new Error(
          'Há imagem sem texto alternativo. Preencha antes de publicar.',
        )
      }
      const versao = artigo.versao + 1
      const campos = {
        titulo: trabalho.titulo,
        slug: slugify(trabalho.titulo),
        conteudo: trabalho.conteudo,
        textoPlano: trabalho.textoPlano,
        resumo: trabalho.resumo,
        publico: trabalho.publico,
        categoria: trabalho.categoria ?? '',
      }
      await atualizarIndiceTx(
        tx,
        artigo.productId,
        artigo.blockId,
        articleId,
        itemDoArtigo({ ...campos, id: articleId, blockId: artigo.blockId }),
      )
      tx.update(artigoRef(articleId), {
        ...campos,
        versaoProduto: trabalho.versaoProduto ?? deleteField(),
        status: 'published',
        versao,
        atualizadoPor: uid,
        atualizadoEm: agora,
        revisadoEm: agora,
        revisao: deleteField(),
        ...(trabalho.aprovadoPor
          ? {
              aprovadoPor: trabalho.aprovadoPor,
              aprovadoEm: trabalho.aprovadoEm,
            }
          : {}),
      })
      if (naRevisao) tx.delete(revisaoRef(articleId))
      const snapshot: ArticleVersion = {
        versao,
        titulo: trabalho.titulo,
        conteudo: trabalho.conteudo,
        origem: sugestaoId ? 'ia' : 'manual',
        autorId: uid,
        criadoEm: agora,
        ...(trabalho.aprovadoPor
          ? {
              aprovadoPor: trabalho.aprovadoPor,
              aprovadoEm: trabalho.aprovadoEm,
            }
          : {}),
      }
      tx.set(
        doc(db, 'articles', articleId, 'versions', String(versao)),
        snapshot,
      )
      if (refSugestao && snapSugestao?.exists()) {
        tx.update(refSugestao, {
          status: 'approved',
          decididoPor: uid,
          decididoEm: agora,
        })
        registrarAuditoria(
          tx,
          uid,
          'sugestao.aprovar',
          `articles/${articleId}/suggestions/${sugestaoId}`,
        )
      }
      versaoPublicada = versao
    } else if (naRevisao) {
      tx.update(revisaoRef(articleId), {
        status: novo,
        atualizadoPor: uid,
        atualizadoEm: agora,
        ...(acao === 'aprovar' ? { aprovadoPor: uid, aprovadoEm: agora } : {}),
      })
      tx.update(artigoRef(articleId), {
        'revisao.status': novo,
        'revisao.atualizadoEm': agora,
      })
    } else {
      // Sair do ar (despublicar ou arquivar um publicado) tira da busca.
      if (artigo.status === 'published') {
        await atualizarIndiceTx(
          tx,
          artigo.productId,
          artigo.blockId,
          articleId,
          null,
        )
      }
      tx.update(artigoRef(articleId), {
        status: novo,
        atualizadoPor: uid,
        atualizadoEm: agora,
        ...(acao === 'aprovar' ? { aprovadoPor: uid, aprovadoEm: agora } : {}),
      })
    }

    if (comentario) {
      const tipo: Comentario['tipo'] =
        acao === 'reprovar'
          ? 'reprovacao'
          : acao === 'aprovar'
            ? 'aprovacao'
            : 'comentario'
      tx.set(doc(collection(db, 'articles', articleId, 'comentarios')), {
        tipo,
        texto: comentario,
        autorId: uid,
        autorNome: opcoes.autorNome ?? uid,
        alvo: naRevisao ? 'revisao' : 'artigo',
        criadoEm: agora,
      })
    }
    registrarAuditoria(
      tx,
      uid,
      AUDITORIA[acao],
      `articles/${articleId}`,
      naRevisao ? 'alteração pendente' : undefined,
    )
  })
  invalidarCacheBusca()
  return { versao: versaoPublicada }
}

/** Aprova e publica de uma vez (duas transições, ambas na trilha). */
export async function aprovarEPublicar(
  articleId: string,
  uid: string,
  opcoes: OpcoesTransicao = {},
): Promise<{ versao?: number }> {
  await transitar(articleId, 'aprovar', uid, opcoes)
  return transitar(articleId, 'publicar', uid, {
    autorNome: opcoes.autorNome,
    sugestaoId: opcoes.sugestaoId,
  })
}

/**
 * Grava as edições. Um artigo publicado NÃO é alterado no lugar: as mudanças
 * vão para a alteração pendente (criada na primeira vez), e a versão publicada
 * continua no ar. Editar algo já aprovado anula a aprovação (volta a "em revisão").
 */
export async function salvarAlteracoes(
  articleId: string,
  draft: ArticleDraft,
  uid: string,
  opcoes: { sugestaoId?: string } = {},
): Promise<{ alvo: 'artigo' | 'revisao' }> {
  validar(draft)
  const campos = camposDerivados(draft)
  let alvo: 'artigo' | 'revisao' = 'artigo'

  await runTransaction(db, async (tx) => {
    const snapArtigo = await tx.get(artigoRef(articleId))
    if (!snapArtigo.exists()) throw new Error('Artigo não encontrado.')
    const artigo = fromSnap(snapArtigo)
    const agora = Date.now()

    if (artigo.status === 'published') {
      alvo = 'revisao'
      const snapRevisao = await tx.get(revisaoRef(articleId))
      const atual = snapRevisao.exists()
        ? (snapRevisao.data() as Revisao)
        : null
      const anulou = atual?.status === 'approved'
      const status: RevisaoStatus = anulou
        ? 'review'
        : (atual?.status ?? 'draft')
      const revisao: Revisao = {
        titulo: campos.titulo,
        conteudo: campos.conteudo,
        textoPlano: campos.textoPlano,
        resumo: campos.resumo,
        publico: campos.publico,
        categoria: campos.categoria,
        ...(campos.versaoProduto
          ? { versaoProduto: campos.versaoProduto }
          : {}),
        status,
        baseVersao: artigo.versao,
        autorId: atual?.autorId ?? uid,
        atualizadoPor: uid,
        criadoEm: atual?.criadoEm ?? agora,
        atualizadoEm: agora,
        ...((opcoes.sugestaoId ?? atual?.sugestaoId)
          ? { sugestaoId: (opcoes.sugestaoId ?? atual?.sugestaoId) as string }
          : {}),
      }
      tx.set(revisaoRef(articleId), revisao)
      tx.update(artigoRef(articleId), {
        revisao: { status, autorId: revisao.autorId, atualizadoEm: agora },
      })
      registrarAuditoria(
        tx,
        uid,
        'revisao.salvar',
        `articles/${articleId}`,
        atual?.status === 'approved'
          ? 'aprovação anulada pela edição'
          : undefined,
      )
      return
    }

    if (artigo.status === 'archived') {
      throw new Error('Restaure o artigo antes de editar.')
    }
    const anulouAprovacao = artigo.status === 'approved'
    tx.update(artigoRef(articleId), {
      ...campos,
      ...(campos.versaoProduto ? {} : { versaoProduto: deleteField() }),
      ...(anulouAprovacao
        ? {
            status: 'review',
            aprovadoPor: deleteField(),
            aprovadoEm: deleteField(),
          }
        : {}),
      atualizadoPor: uid,
      atualizadoEm: agora,
    })
    registrarAuditoria(
      tx,
      uid,
      'artigo.editar',
      `articles/${articleId}`,
      anulouAprovacao ? 'aprovação anulada pela edição' : undefined,
    )
  })
  return { alvo }
}

/** Descarta a alteração pendente; a versão publicada continua como está. */
export async function descartarRevisao(
  articleId: string,
  uid: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(artigoRef(articleId))
    if (!snap.exists() || !fromSnap(snap).revisao) {
      throw new Error('Não há alteração pendente neste artigo.')
    }
    tx.delete(revisaoRef(articleId))
    tx.update(artigoRef(articleId), { revisao: deleteField() })
    registrarAuditoria(tx, uid, 'revisao.descartar', `articles/${articleId}`)
  })
}

/**
 * Aprova uma sugestão (IA ou ingestão) e a publica como nova versão. A tela de
 * sugestões é a revisão: o admin compara as duas versões lado a lado. Só vale
 * para artigo publicado e sem outra alteração pendente.
 */
export async function aprovarSugestao(
  articleId: string,
  draft: ArticleDraft,
  uid: string,
  sugestaoId: string,
): Promise<number> {
  validar(draft)
  const campos = camposDerivados(draft)
  let versao = 0
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(artigoRef(articleId))
    if (!snap.exists()) throw new Error('Artigo não encontrado.')
    const artigo = fromSnap(snap)
    if (artigo.status !== 'published') {
      throw new Error(
        'Só dá para aprovar a sugestão de um artigo publicado. Abra-a no editor para incorporá-la ao rascunho.',
      )
    }
    if (artigo.revisao) {
      throw new Error(
        'Há uma alteração pendente neste artigo. Publique-a ou descarte-a antes.',
      )
    }
    const refSugestao = doc(
      db,
      'articles',
      articleId,
      'suggestions',
      sugestaoId,
    )
    const sugestao = await tx.get(refSugestao)
    const agora = Date.now()
    versao = artigo.versao + 1
    await atualizarIndiceTx(
      tx,
      artigo.productId,
      artigo.blockId,
      articleId,
      itemDoArtigo({ ...campos, id: articleId, blockId: artigo.blockId }),
    )
    tx.update(artigoRef(articleId), {
      ...campos,
      status: 'published',
      versao,
      atualizadoPor: uid,
      atualizadoEm: agora,
      revisadoEm: agora,
      aprovadoPor: uid,
      aprovadoEm: agora,
    })
    tx.set(doc(db, 'articles', articleId, 'versions', String(versao)), {
      versao,
      titulo: draft.titulo.trim(),
      conteudo: draft.conteudo,
      origem: 'ia',
      autorId: uid,
      criadoEm: agora,
      aprovadoPor: uid,
      aprovadoEm: agora,
    } satisfies ArticleVersion)
    if (sugestao.exists()) {
      tx.update(refSugestao, {
        status: 'approved',
        decididoPor: uid,
        decididoEm: agora,
      })
      registrarAuditoria(
        tx,
        uid,
        'sugestao.aprovar',
        `articles/${articleId}/suggestions/${sugestaoId}`,
      )
    }
    registrarAuditoria(
      tx,
      uid,
      'artigo.publicar',
      `articles/${articleId}`,
      'sugestão aprovada',
    )
  })
  invalidarCacheBusca()
  return versao
}
