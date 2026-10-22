import { createHash } from 'node:crypto'
import path from 'node:path'
import type { Article, Block } from '../../src/types/content.ts'
import {
  extrairTextoPlano,
  gerarResumo,
  imagensSemAlt,
} from '../../src/utils/content.ts'
import { slugify } from '../../src/utils/slug.ts'
import { PREFIXO_ARTIGO, converter, type LinkResolvido } from './convert.ts'
import type { Manifesto, ManifestoArtigo, Plano, Relatorio } from './types.ts'

export interface PlanoDeps {
  /** Devolve o conteúdo bruto (HTML ou Markdown) do artigo. */
  lerConteudo(artigo: ManifestoArtigo): Promise<string>
  /** `dirDoArtigo` é relativo à raiz do export; caminhos locais valem a partir dele. */
  resolverImagem(
    src: string,
    dirDoArtigo: string,
  ): Promise<{ url: string } | { erro: string }>
  /** Opcional: confere links externos. Devolve o motivo da falha, ou `null`. */
  verificarLink?(href: string): Promise<string | null>
  agora: number
  autorId: string
}

/** Id estável no Firestore: legível, e com sufixo de hash só em colisões. */
export function criarGeradorDeIds(prefixo: string) {
  const usados = new Set<string>()
  return (origem: string): string => {
    const base = `${prefixo}-${slugify(origem) || 'item'}`
    let id = base
    if (usados.has(id)) {
      id = `${base}-${createHash('sha1').update(origem).digest('hex').slice(0, 6)}`
    }
    usados.add(id)
    return id
  }
}

const normalizarCaminho = (p: string) =>
  path.posix.normalize(p.replace(/\\/g, '/')).replace(/^\.\//, '')

function formatoDe(a: ManifestoArtigo): 'html' | 'markdown' {
  if (a.formato) return a.formato
  return /\.(md|markdown)$/i.test(a.arquivo ?? '') ? 'markdown' : 'html'
}

export function relatorioVazio(): Relatorio {
  return {
    resumo: {
      blocos: 0,
      artigos: 0,
      publicados: 0,
      rascunhos: 0,
      imagensOk: 0,
      imagensComFalha: 0,
      linksQuebrados: 0,
      artigosSemBloco: 0,
    },
    imagensComFalha: [],
    linksQuebrados: [],
    artigosSemBloco: [],
    altsGerados: [],
    avisos: [],
    erros: [],
  }
}

export async function planejar(
  manifesto: Manifesto,
  deps: PlanoDeps,
): Promise<Plano> {
  const relatorio = relatorioVazio()

  // Blocos: ids de destino, hierarquia e productId desnormalizado.
  const novoIdBloco = criarGeradorDeIds('m')
  const idDoBloco = new Map(
    manifesto.blocos.map((b) => [b.id, novoIdBloco(b.id)]),
  )
  const paiDe = new Map(manifesto.blocos.map((b) => [b.id, b.pai ?? null]))
  const raizDe = (id: string): string => {
    let atual = id
    for (let pai = paiDe.get(atual); pai; pai = paiDe.get(atual)) atual = pai
    return atual
  }
  const irmaos = new Map<string | null, number>()
  const blocos: Block[] = manifesto.blocos.map((b) => {
    const chave = b.pai ?? null
    const posicao = irmaos.get(chave) ?? 0
    irmaos.set(chave, posicao + 1)
    return {
      id: idDoBloco.get(b.id) as string,
      nome: b.nome.trim(),
      slug: slugify(b.nome),
      descricao: b.descricao?.trim() ?? '',
      icone: b.icone?.trim() ?? '',
      ordem: b.ordem ?? posicao,
      parentId: b.pai ? (idDoBloco.get(b.pai) as string) : null,
      productId: idDoBloco.get(raizDe(b.id)) as string,
    }
  })
  const blocoPorId = new Map(blocos.map((b) => [b.id, b]))

  // Artigos importáveis (com bloco) e as tabelas usadas para resolver links.
  const novoIdArtigo = criarGeradorDeIds('m')
  const importaveis: Array<{ origem: ManifestoArtigo; id: string }> = []
  for (const a of manifesto.artigos) {
    if (!idDoBloco.has(a.bloco)) {
      relatorio.artigosSemBloco.push({
        id: a.id,
        titulo: a.titulo,
        bloco: a.bloco,
      })
      continue
    }
    importaveis.push({ origem: a, id: novoIdArtigo(a.id) })
  }
  const idPorOrigem = new Map(importaveis.map((i) => [i.origem.id, i.id]))
  const idPorArquivo = new Map(
    importaveis.flatMap((i) =>
      i.origem.arquivo
        ? [[normalizarCaminho(i.origem.arquivo), i.id] as const]
        : [],
    ),
  )

  const artigos: Article[] = []
  for (const { origem, id } of importaveis) {
    const resolverLink = async (href: string): Promise<LinkResolvido> => {
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        const motivo = /^https?:/i.test(href)
          ? await deps.verificarLink?.(href)
          : null
        return motivo ? { tipo: 'quebrado', motivo } : { tipo: 'manter', href }
      }
      if (href.startsWith('#')) {
        return { tipo: 'quebrado', motivo: 'âncora interna não suportada' }
      }
      if (href.startsWith(PREFIXO_ARTIGO)) {
        const ref = href.slice(PREFIXO_ARTIGO.length)
        const alvo = idPorOrigem.get(ref)
        return alvo
          ? { tipo: 'manter', href: `/a/${alvo}` }
          : { tipo: 'quebrado', motivo: `artigo "${ref}" não existe` }
      }
      const limpo = decodeURIComponent(href.split(/[?#]/)[0] ?? '')
      const dir = origem.arquivo
        ? path.posix.dirname(normalizarCaminho(origem.arquivo))
        : '.'
      const alvo =
        idPorArquivo.get(normalizarCaminho(path.posix.join(dir, limpo))) ??
        idPorArquivo.get(normalizarCaminho(limpo))
      return alvo
        ? { tipo: 'manter', href: `/a/${alvo}` }
        : { tipo: 'quebrado', motivo: 'destino não encontrado no export' }
    }

    const dirDoArtigo = origem.arquivo
      ? path.posix.dirname(normalizarCaminho(origem.arquivo))
      : '.'
    try {
      const fonte = await deps.lerConteudo(origem)
      const { doc, naoSuportados } = await converter(fonte, formatoDe(origem), {
        titulo: origem.titulo,
        resolverImagem: async (src) => {
          const r = await deps.resolverImagem(src, dirDoArtigo)
          if ('erro' in r) relatorio.resumo.imagensComFalha++
          else relatorio.resumo.imagensOk++
          return r
        },
        resolverLink,
        aoFalharImagem: (src, motivo) =>
          relatorio.imagensComFalha.push({ artigo: origem.id, src, motivo }),
        aoGerarAlt: (src, alt) =>
          relatorio.altsGerados.push({ artigo: origem.id, src, alt }),
        aoQuebrarLink: (href, motivo) => {
          relatorio.resumo.linksQuebrados++
          relatorio.linksQuebrados.push({ artigo: origem.id, href, motivo })
        },
      })
      if (naoSuportados.length) {
        relatorio.avisos.push({
          artigo: origem.id,
          mensagem: `elementos sem suporte no editor (viram texto): ${naoSuportados.join(', ')}`,
        })
      }
      if (imagensSemAlt(doc) > 0) {
        throw new Error('imagem sem texto alternativo após a conversão')
      }
      const textoPlano = extrairTextoPlano(doc)
      if (!textoPlano) {
        relatorio.avisos.push({
          artigo: origem.id,
          mensagem: 'artigo sem texto',
        })
      }
      const publicado = origem.publicado ?? true
      const atualizado = origem.atualizadoEm
        ? Date.parse(origem.atualizadoEm)
        : deps.agora
      const bloco = blocoPorId.get(
        idDoBloco.get(origem.bloco) as string,
      ) as Block
      artigos.push({
        id,
        blockId: bloco.id,
        productId: bloco.productId,
        titulo: origem.titulo.trim(),
        slug: slugify(origem.titulo),
        resumo: gerarResumo(textoPlano),
        conteudo: doc,
        textoPlano,
        publico: origem.publico ?? 'usuario',
        ...(origem.versaoProduto?.trim()
          ? { versaoProduto: origem.versaoProduto.trim() }
          : {}),
        status: publicado ? 'published' : 'draft',
        flags: [],
        views: 0,
        versao: publicado ? 1 : 0,
        autorId: deps.autorId,
        atualizadoPor: deps.autorId,
        criadoEm: atualizado,
        atualizadoEm: atualizado,
        revisadoEm: atualizado,
      })
    } catch (e) {
      relatorio.erros.push({
        artigo: origem.id,
        mensagem: (e as Error).message,
      })
    }
  }

  relatorio.resumo.blocos = blocos.length
  relatorio.resumo.artigos = artigos.length
  relatorio.resumo.publicados = artigos.filter(
    (a) => a.status === 'published',
  ).length
  relatorio.resumo.rascunhos = artigos.length - relatorio.resumo.publicados
  relatorio.resumo.artigosSemBloco = relatorio.artigosSemBloco.length
  return { blocos, artigos, relatorio }
}
