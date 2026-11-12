import { createHash } from 'node:crypto'
import type { JSONContent } from '@tiptap/react'
import type { Firestore } from 'firebase-admin/firestore'
import type { Article, ArticleStatus } from '../../src/types/content.ts'
import { comDescendentes } from '../../src/utils/blocos.ts'
import { extrairTextoPlano, gerarResumo } from '../../src/utils/content.ts'
import { conferirManual, type Problema } from '../../src/utils/padraoManual.ts'
import { docParaMarkdown } from '../../src/utils/tiptapMarkdown.ts'
import { acharBloco, acharProduto } from '../ingestao/ingerir.ts'
import { converter } from '../migrate/convert.ts'
import type { ProvedorIA } from './ia.ts'

export interface PadraoLido {
  /** Caminho de origem (para rastrear na sugestão). */
  arquivo: string
  texto: string
  /** Hash do padrão: mudou o padrão, as sugestões antigas deixam de valer. */
  hash: string
}

export function lerPadrao(arquivo: string, texto: string): PadraoLido {
  return {
    arquivo,
    texto,
    hash: createHash('sha1').update(texto).digest('hex').slice(0, 16),
  }
}

/** Conteúdo de `articles/{id}/suggestions/{sid}`, salvo o que o gravador acrescenta. */
export interface SugestaoGerada {
  titulo: string
  conteudo: JSONContent
  textoPlano: string
  resumo: string
  diffResumo: string[]
  motivo: string
  avisos: string[]
  modelo: string
}

export type ResultadoProposta =
  | { tipo: 'nenhuma'; motivo: string }
  | { tipo: 'sugestao'; sugestao: SugestaoGerada }

const normalizar = (md: string) => md.replace(/\s+/g, ' ').trim()

function imagensDe(doc: JSONContent): { src: string; alt: string }[] {
  const lista: { src: string; alt: string }[] = []
  const visitar = (n: JSONContent) => {
    if (n.type === 'image') {
      lista.push({
        src: String(n.attrs?.src ?? ''),
        alt: String(n.attrs?.alt ?? ''),
      })
    }
    n.content?.forEach(visitar)
  }
  visitar(doc)
  return lista
}

/** Sequências de dígitos do texto (prazos, tamanhos, versões): não podem sumir. */
export function numerosDe(texto: string): string[] {
  return [...new Set(texto.match(/\d+(?:[.,]\d+)*/g) ?? [])]
}

/** Pede à IA a padronização de um artigo e converte a resposta no formato do editor. */
export async function gerarProposta(
  artigo: Pick<Article, 'titulo' | 'conteudo'>,
  padrao: PadraoLido,
  provedor: ProvedorIA,
  problemas: Problema[],
): Promise<ResultadoProposta> {
  const markdownAtual = docParaMarkdown(artigo.conteudo)
  const proposta = await provedor.propor({
    tituloArtigo: artigo.titulo,
    markdownAtual,
    padrao: padrao.texto,
    problemas,
  })
  if (!proposta.precisa_padronizar) {
    return {
      tipo: 'nenhuma',
      motivo: proposta.motivo || 'a IA considera o artigo dentro do padrão',
    }
  }
  if (!proposta.conteudo_markdown.trim()) {
    throw new Error('a IA pediu padronização, mas não devolveu o conteúdo')
  }
  if (normalizar(proposta.conteudo_markdown) === normalizar(markdownAtual)) {
    return { tipo: 'nenhuma', motivo: 'a IA devolveu o texto sem alterações' }
  }

  const { doc } = await converter(proposta.conteudo_markdown, 'markdown', {
    titulo: artigo.titulo,
    // As imagens já estão no Cloudinary; a IA não deve mexer nelas.
    resolverImagem: async (src) => ({ url: src }),
    resolverLink: async (href) => ({ tipo: 'manter', href }),
    aoFalharImagem: () => {},
    aoGerarAlt: () => {},
    aoQuebrarLink: () => {},
  })

  const avisos: string[] = []
  const antes = imagensDe(artigo.conteudo)
  const depois = imagensDe(doc)
  const mesmas =
    antes.length === depois.length &&
    antes.every((a, i) => a.src === depois[i]?.src && a.alt === depois[i]?.alt)
  if (!mesmas) {
    avisos.push(
      `as imagens mudaram (eram ${antes.length}, agora ${depois.length}, ou trocaram de ordem ou de texto alternativo): confira`,
    )
  }

  const originais = numerosDe(extrairTextoPlano(artigo.conteudo))
  const novos = new Set(numerosDe(extrairTextoPlano(doc)))
  const sumiram = originais.filter((n) => !novos.has(n))
  if (sumiram.length > 0) {
    avisos.push(
      `números do original que não aparecem na sugestão: ${sumiram.join(', ')}`,
    )
  }

  const confirmar = proposta.conteudo_markdown.match(/\[Confirmar:[^\]]*\]/g)
  if (confirmar) {
    avisos.push(
      `${confirmar.length} ponto(s) a confirmar no texto: [Confirmar: …]`,
    )
  }
  for (const d of proposta.duvidas) avisos.push(`dúvida da IA: ${d}`)

  const textoPlano = extrairTextoPlano(doc)
  return {
    tipo: 'sugestao',
    sugestao: {
      titulo: proposta.titulo.trim() || artigo.titulo,
      conteudo: doc,
      textoPlano,
      resumo: gerarResumo(textoPlano),
      diffResumo: proposta.mudancas,
      motivo: proposta.motivo,
      avisos,
      modelo: provedor.modelo,
    },
  }
}

export interface OpcoesPadronizar {
  /** Produto: id, nome ou slug. */
  produto: string
  /** Subproduto/módulo (e tudo abaixo dele). */
  bloco?: string
  /** Artigos explícitos (ids); ignoram `status` e `bloco`. */
  artigos?: string[]
  /** Estados dos artigos considerados. Padrão: só os que estão em revisão. */
  status: ArticleStatus[]
  /** Máximo de artigos tratados numa execução (os piores primeiro). */
  limite: number
  /** Só trata artigos com pelo menos tantos problemas na conferência local. */
  minProblemas: number
  /** Sem isto, só a conferência local (sem custo). */
  usarIA: boolean
  /** Com a IA, grava as sugestões (sem isto, roda a IA e só relata). */
  gravar: boolean
  agora: number
}

export type StatusPadronizar =
  | 'conferido'
  | 'criada'
  | 'simulada'
  | 'ja-existia'
  | 'nenhuma-mudanca'
  | 'erro'

export interface ResultadoArtigo {
  artigoId: string
  titulo: string
  status: StatusPadronizar
  problemas: Problema[]
  detalhe?: string
  mudancas?: string[]
  avisos?: string[]
}

export interface ResultadoPadronizar {
  produto: string
  /** Artigos olhados pela conferência local. */
  total: number
  /** Dos olhados, quantos não têm problema nenhum. */
  semProblemas: number
  /** Artigos com problema que ficaram de fora por causa do limite. */
  alemDoLimite: number
  resultados: ResultadoArtigo[]
}

/** Id estável: o mesmo padrão sobre o mesmo texto não gera sugestões repetidas. */
export function idDaSugestao(
  artigoId: string,
  padraoHash: string,
  markdown: string,
): string {
  return createHash('sha1')
    .update(
      `padronizacao\n${artigoId}\n${padraoHash}\n${createHash('sha1').update(markdown).digest('hex')}`,
    )
    .digest('hex')
    .slice(0, 20)
}

async function artigosAlvo(db: Firestore, opts: OpcoesPadronizar) {
  const produto = await acharProduto(db, opts.produto)
  if (opts.artigos?.length) {
    const snaps = await Promise.all(
      opts.artigos.map((id) => db.collection('articles').doc(id).get()),
    )
    const faltando = opts.artigos.filter((_, i) => !snaps[i]?.exists)
    if (faltando.length)
      throw new Error(`Artigo(s) não encontrado(s): ${faltando.join(', ')}`)
    return { produto, docs: snaps }
  }
  let docs = (
    await db
      .collection('articles')
      .where('productId', '==', produto.id)
      .where('status', 'in', opts.status)
      .get()
  ).docs
  if (opts.bloco) {
    const raiz = await acharBloco(db, produto, opts.bloco)
    const blocos = (
      await db.collection('blocks').where('productId', '==', produto.id).get()
    ).docs.map((d) => ({ id: d.id, parentId: d.get('parentId') ?? null }))
    const ids = comDescendentes(
      blocos as unknown as Parameters<typeof comDescendentes>[0],
      raiz.id,
    )
    docs = docs.filter((d) => ids.has(String(d.get('blockId'))))
  }
  return { produto, docs }
}

/**
 * Confere os artigos com o padrão de manual e, com `usarIA`, gera uma sugestão
 * de reescrita para os que têm mais problemas. Nunca publica nem altera o
 * artigo: só escreve em `articles/{id}/suggestions`.
 */
export async function padronizar(
  db: Firestore,
  padrao: PadraoLido,
  provedor: ProvedorIA | null,
  opts: OpcoesPadronizar,
): Promise<ResultadoPadronizar> {
  const { produto, docs } = await artigosAlvo(db, opts)

  const avaliados = docs
    .map((d) => {
      const artigo = { id: d.id, ...d.data() } as Article
      const markdown = docParaMarkdown(artigo.conteudo)
      return {
        artigo,
        markdown,
        problemas: conferirManual(artigo.titulo, markdown),
      }
    })
    .sort((a, b) => b.problemas.length - a.problemas.length)

  const comProblema = avaliados.filter(
    (a) => a.problemas.length >= Math.max(1, opts.minProblemas),
  )
  const escolhidos = comProblema.slice(0, opts.limite)
  const saida: ResultadoPadronizar = {
    produto: produto.nome,
    total: avaliados.length,
    semProblemas: avaliados.filter((a) => a.problemas.length === 0).length,
    alemDoLimite: comProblema.length - escolhidos.length,
    resultados: [],
  }

  for (const { artigo, markdown, problemas } of escolhidos) {
    const base = { artigoId: artigo.id, titulo: artigo.titulo, problemas }
    if (!opts.usarIA || !provedor) {
      saida.resultados.push({ ...base, status: 'conferido' })
      continue
    }
    try {
      const sid = idDaSugestao(artigo.id, padrao.hash, markdown)
      const ref = db.collection('articles').doc(artigo.id)
      const sugRef = ref.collection('suggestions').doc(sid)
      if ((await sugRef.get()).exists) {
        saida.resultados.push({ ...base, status: 'ja-existia' })
        continue
      }
      const r = await gerarProposta(artigo, padrao, provedor, problemas)
      if (r.tipo === 'nenhuma') {
        saida.resultados.push({
          ...base,
          status: 'nenhuma-mudanca',
          detalhe: r.motivo,
        })
        continue
      }
      const info = {
        mudancas: r.sugestao.diffResumo,
        avisos: r.sugestao.avisos,
      }
      if (!opts.gravar) {
        saida.resultados.push({ ...base, ...info, status: 'simulada' })
        continue
      }
      const batch = db.batch()
      batch.create(sugRef, {
        ...r.sugestao,
        pratsDesatualizados: false,
        status: 'pending',
        automatico: false,
        origem: {
          tipo: 'padronizacao',
          arquivo: padrao.arquivo,
          hash: padrao.hash,
        },
        // Vale para a versão que a IA leu; se o artigo mudar depois, o revisor vê.
        baseVersao: artigo.versao,
        baseAtualizadoEm: artigo.atualizadoEm,
        criadoEm: opts.agora,
      })
      batch.set(db.collection('auditLog').doc(), {
        usuarioId: 'padronizar',
        acao: 'sugestao.criar',
        alvo: `articles/${artigo.id}/suggestions/${sid}`,
        data: opts.agora,
      })
      await batch.commit()
      saida.resultados.push({ ...base, ...info, status: 'criada' })
    } catch (e) {
      saida.resultados.push({
        ...base,
        status: 'erro',
        detalhe: (e as Error).message,
      })
    }
  }
  return saida
}
