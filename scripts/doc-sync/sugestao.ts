import type { JSONContent } from '@tiptap/react'
import type { Article } from '../../src/types/content.ts'
import { extrairTextoPlano, gerarResumo } from '../../src/utils/content.ts'
import { docParaMarkdown } from '../../src/utils/tiptapMarkdown.ts'
import { converter } from '../migrate/convert.ts'
import type { ProvedorIA } from './ia.ts'
import type { Regras } from './regras.ts'

/** Conteúdo de `articles/{id}/suggestions/{sid}`, salvo o que o gravador acrescenta. */
export interface SugestaoGerada {
  titulo: string
  conteudo: JSONContent
  textoPlano: string
  resumo: string
  /** Lista curta das alterações, escrita pela IA. */
  diffResumo: string[]
  motivo: string
  prints_desatualizados: boolean
  /** Problemas que o revisor deve olhar (imagem sumiu, alt gerado…). */
  avisos: string[]
  modelo: string
}

export type ResultadoSugestao =
  | { tipo: 'nenhuma'; motivo: string }
  | { tipo: 'sugestao'; sugestao: SugestaoGerada }

const normalizar = (md: string) => md.replace(/\s+/g, ' ').trim()

function imagensDe(doc: JSONContent): string[] {
  const urls: string[] = []
  const visitar = (n: JSONContent) => {
    if (n.type === 'image') urls.push(String(n.attrs?.src ?? ''))
    n.content?.forEach(visitar)
  }
  visitar(doc)
  return urls
}

/** Pede à IA a atualização de um artigo e converte a resposta no formato do editor. */
export async function gerarSugestao(
  artigo: Pick<Article, 'titulo' | 'conteudo'>,
  regras: Regras,
  provedor: ProvedorIA,
): Promise<ResultadoSugestao> {
  const markdownAtual = docParaMarkdown(artigo.conteudo)
  const proposta = await provedor.propor({
    tituloArtigo: artigo.titulo,
    markdownAtual,
    regras,
  })
  if (!proposta.precisa_atualizar) {
    return {
      tipo: 'nenhuma',
      motivo: proposta.motivo || 'a IA não vê mudanças necessárias',
    }
  }
  if (!proposta.conteudo_markdown.trim()) {
    throw new Error('a IA pediu atualização, mas não devolveu o conteúdo')
  }
  if (normalizar(proposta.conteudo_markdown) === normalizar(markdownAtual)) {
    return { tipo: 'nenhuma', motivo: 'a IA devolveu o texto sem alterações' }
  }

  const avisos: string[] = []
  const { doc } = await converter(proposta.conteudo_markdown, 'markdown', {
    titulo: artigo.titulo,
    // As imagens já estão no Cloudinary; a IA só pode mantê-las ou removê-las.
    resolverImagem: async (src) => ({ url: src }),
    resolverLink: async (href) => ({ tipo: 'manter', href }),
    aoFalharImagem: () => {},
    aoGerarAlt: (src) =>
      avisos.push(`imagem sem texto alternativo (ganhou um genérico): ${src}`),
    aoQuebrarLink: () => {},
  })

  const novas = new Set(imagensDe(doc))
  for (const src of imagensDe(artigo.conteudo)) {
    if (!novas.has(src))
      avisos.push(`a imagem foi removida da sugestão: ${src}`)
  }
  for (const src of novas) {
    if (!imagensDe(artigo.conteudo).includes(src)) {
      avisos.push(`imagem nova que não existia no artigo: ${src}`)
    }
  }

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
      prints_desatualizados: proposta.prints_desatualizados,
      avisos,
      modelo: provedor.modelo,
    },
  }
}
