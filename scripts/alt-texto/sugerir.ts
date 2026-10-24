import { createHash } from 'node:crypto'
import type { Firestore } from 'firebase-admin/firestore'
import type { Article } from '../../src/types/content.ts'
import {
  altFraco,
  aplicarAlts,
  imagensComContexto,
  normalizarAlt,
  type ImagemComContexto,
} from '../../src/utils/altTexto.ts'
import { extrairTextoPlano, gerarResumo } from '../../src/utils/content.ts'
import type { ProvedorAlt } from './ia.ts'

export interface OpcoesAlt {
  /** Ids dos artigos. Sem eles, `todos` varre todos os artigos publicados. */
  artigos?: string[]
  todos?: boolean
  /** Reescreve também os alts que parecem bons (por padrão só os fracos). */
  revisarTodas?: boolean
  /** Manda só o texto, sem a imagem (mais barato, bem pior). */
  semImagem?: boolean
  /** Máximo de artigos processados numa execução. */
  limiteArtigos?: number
  /** Imagens por pedido à IA. */
  imagensPorPedido?: number
  gravar: boolean
  agora: number
}

export type StatusAlt =
  | 'criada'
  | 'simulada'
  | 'ja-existia'
  | 'nada-a-fazer'
  | 'nenhuma-mudanca'
  | 'artigo-nao-encontrado'
  | 'erro'

export interface ResultadoAlt {
  artigoId: string
  titulo: string
  status: StatusAlt
  imagens: number
  detalhe?: string
  /** As mudanças propostas, para mostrar no terminal. */
  mudancas?: string[]
}

type Confianca = 'alta' | 'media' | 'baixa'
interface Proposta {
  alt: string
  confianca: Confianca
  decorativa: boolean
  semImagem: boolean
}

/** Imagens do artigo que precisam de um alt melhor. */
export function imagensAlvo(
  conteudo: Article['conteudo'],
  revisarTodas: boolean,
): ImagemComContexto[] {
  return imagensComContexto(conteudo).filter(
    (i) => i.src && (revisarTodas || altFraco(i.alt)),
  )
}

export function idDaSugestaoAlt(
  artigoId: string,
  imagens: ImagemComContexto[],
): string {
  const base = imagens.map((i) => `${i.indice}|${i.src}|${i.alt}`).join('\n')
  return createHash('sha1')
    .update(`alt\n${artigoId}\n${base}`)
    .digest('hex')
    .slice(0, 20)
}

/**
 * Pede os alts em lotes. Se um lote falha (em geral uma imagem que a IA não
 * consegue abrir), tenta imagem por imagem e, por fim, só com o texto, caso
 * em que a confiança é rebaixada para "baixa".
 */
async function pedirAlts(
  provedor: ProvedorAlt,
  titulo: string,
  alvo: ImagemComContexto[],
  opcoes: OpcoesAlt,
): Promise<Map<number, Proposta>> {
  const resultado = new Map<number, Proposta>()
  const porPedido = opcoes.imagensPorPedido ?? 12

  const registrar = (
    imagens: ImagemComContexto[],
    resposta: Awaited<ReturnType<ProvedorAlt['sugerir']>>,
    semImagem: boolean,
  ) => {
    const pedidos = new Set(imagens.map((i) => i.indice))
    for (const t of resposta.textos) {
      const alt = normalizarAlt(t.alt)
      if (!pedidos.has(t.indice) || !alt) continue
      resultado.set(t.indice, {
        alt,
        confianca: semImagem ? 'baixa' : t.confianca,
        decorativa: t.decorativa,
        semImagem,
      })
    }
  }

  const tentar = async (imagens: ImagemComContexto[], comImagem: boolean) =>
    provedor.sugerir({ tituloArtigo: titulo, imagens, comImagem })

  for (let i = 0; i < alvo.length; i += porPedido) {
    const lote = alvo.slice(i, i + porPedido)
    try {
      registrar(lote, await tentar(lote, !opcoes.semImagem), !!opcoes.semImagem)
      continue
    } catch (e) {
      if (lote.length === 1 && opcoes.semImagem) throw e
    }
    for (const img of lote) {
      try {
        registrar(
          [img],
          await tentar([img], !opcoes.semImagem),
          !!opcoes.semImagem,
        )
      } catch {
        // A imagem não abre: ainda dá para tentar pelo texto ao redor.
        registrar([img], await tentar([img], false), true)
      }
    }
  }
  return resultado
}

const aspas = (t: string) => (t.trim() ? `“${t.trim()}”` : '(sem texto)')

/**
 * Propõe textos alternativos melhores. Nunca altera o artigo: grava uma
 * sugestão pendente em `articles/{id}/suggestions`, que um admin revisa e
 * aprova na tela "Sugestões".
 */
export async function sugerirAltTextos(
  db: Firestore,
  provedor: ProvedorAlt,
  opcoes: OpcoesAlt,
): Promise<ResultadoAlt[]> {
  let ids = opcoes.artigos ?? []
  if (ids.length === 0 && opcoes.todos) {
    const snap = await db
      .collection('articles')
      .where('status', '==', 'published')
      .get()
    ids = snap.docs.map((d) => d.id)
  }
  const saida: ResultadoAlt[] = []
  let processados = 0

  for (const id of ids) {
    if (opcoes.limiteArtigos && processados >= opcoes.limiteArtigos) break
    const ref = db.collection('articles').doc(id)
    const base = { artigoId: id, titulo: id, imagens: 0 }
    try {
      const snap = await ref.get()
      if (!snap.exists) {
        saida.push({ ...base, status: 'artigo-nao-encontrado' })
        continue
      }
      const artigo = { id, ...snap.data() } as Article
      const alvo = imagensAlvo(artigo.conteudo, !!opcoes.revisarTodas)
      const info = { artigoId: id, titulo: artigo.titulo, imagens: alvo.length }
      if (alvo.length === 0) {
        saida.push({ ...info, status: 'nada-a-fazer' })
        continue
      }
      processados++

      const sid = idDaSugestaoAlt(id, alvo)
      const sugRef = ref.collection('suggestions').doc(sid)
      if ((await sugRef.get()).exists) {
        saida.push({ ...info, status: 'ja-existia' })
        continue
      }

      const propostas = await pedirAlts(provedor, artigo.titulo, alvo, opcoes)
      const novos = new Map<number, string>()
      const mudancas: string[] = []
      const avisos: string[] = []
      for (const img of alvo) {
        const p = propostas.get(img.indice)
        const rotulo = `Imagem ${img.indice + 1}${img.secao ? ` (seção ${aspas(img.secao)})` : ''}`
        if (!p) {
          avisos.push(
            `${rotulo}: a IA não devolveu um texto; o alt continua o mesmo`,
          )
          continue
        }
        if (p.alt === img.alt.trim()) continue
        novos.set(img.indice, p.alt)
        mudancas.push(`${rotulo}: ${aspas(img.alt)} → ${aspas(p.alt)}`)
        if (p.semImagem)
          avisos.push(
            `${rotulo}: a IA não conseguiu ver a imagem, só o texto ao redor; confira`,
          )
        else if (p.confianca === 'baixa')
          avisos.push(`${rotulo}: confiança baixa, confira a descrição`)
        else if (p.confianca === 'media')
          avisos.push(`${rotulo}: confiança média, vale conferir`)
        if (p.decorativa)
          avisos.push(
            `${rotulo}: parece decorativa (ícone ou separador); considere removê-la do artigo`,
          )
      }
      if (novos.size === 0) {
        saida.push({
          ...info,
          status: 'nenhuma-mudanca',
          detalhe: avisos.join('; ') || undefined,
        })
        continue
      }

      if (!opcoes.gravar) {
        saida.push({ ...info, status: 'simulada', mudancas })
        continue
      }
      const conteudo = aplicarAlts(artigo.conteudo, novos)
      const textoPlano = extrairTextoPlano(conteudo)
      const batch = db.batch()
      batch.create(sugRef, {
        titulo: artigo.titulo,
        conteudo,
        textoPlano,
        resumo: gerarResumo(textoPlano),
        diffResumo: mudancas,
        motivo: `Textos alternativos para ${novos.size} imagem(ns) sem uma descrição útil.`,
        avisos,
        pratsDesatualizados: false,
        modelo: provedor.modelo,
        status: 'pending',
        automatico: false,
        origem: {
          tipo: 'alt-texto',
          arquivo: 'Textos alternativos (IA)',
          hash: sid,
        },
        baseVersao: artigo.versao,
        baseAtualizadoEm: artigo.atualizadoEm,
        criadoEm: opcoes.agora,
      })
      batch.set(db.collection('auditLog').doc(), {
        usuarioId: 'alt-texto',
        acao: 'sugestao.criar',
        alvo: `articles/${id}/suggestions/${sid}`,
        data: opcoes.agora,
      })
      await batch.commit()
      saida.push({ ...info, status: 'criada', mudancas })
    } catch (e) {
      saida.push({ ...base, status: 'erro', detalhe: (e as Error).message })
    }
  }
  return saida
}
