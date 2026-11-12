import { altFraco } from './altTexto.ts'

/** O que a conferência local aponta num artigo (veja `docs/padrao-de-manual.md`). */
export type CodigoProblema =
  | 'paragrafo-longo'
  | 'sem-secoes'
  | 'definicoes-em-paragrafos'
  | 'imagem-sem-alt'
  | 'figura-por-posicao'
  | 'procedimento-sem-passos'
  | 'caixa-alta'
  | 'pre-requisito-no-fim'

export interface Problema {
  codigo: CodigoProblema
  mensagem: string
}

const PARAGRAFO_LONGO = 600
const TEXTO_SEM_SECOES = 1500

/** Blocos separados por linha em branco, sem os trechos de código. */
function blocosDe(markdown: string): string[] {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}

const ehTexto = (b: string) => !/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|\||!\[)/.test(b)
const altVazioOuGenerico = (alt: string) =>
  altFraco(alt) ||
  /^(img|imagem|figura|print|foto|screenshot)?[\s:.\-\d]*$/i.test(alt.trim())

/**
 * Confere, sem IA, os sinais mais comuns de um artigo fora do padrão de
 * manual. Serve para priorizar o que mandar à IA e para o revisor saber o que
 * olhar. Não é um juiz: um artigo sem problemas aqui ainda pode melhorar.
 */
export function conferirManual(
  titulo: string,
  markdownBruto: string,
): Problema[] {
  const markdown = markdownBruto.replace(/```[\s\S]*?```/g, '')
  const blocos = blocosDe(markdown)
  const texto = blocos.filter(ehTexto)
  const saida: Problema[] = []
  const add = (codigo: CodigoProblema, mensagem: string) =>
    saida.push({ codigo, mensagem })

  const longos = texto.filter((b) => b.length > PARAGRAFO_LONGO)
  if (longos.length > 0) {
    add(
      'paragrafo-longo',
      `${longos.length} parágrafo(s) com mais de ${PARAGRAFO_LONGO} caracteres: quebrar em parágrafos curtos, lista ou tabela`,
    )
  }

  const corrido = texto.join(' ').length
  if (corrido > TEXTO_SEM_SECOES && !/^#{2,3}\s/m.test(markdown)) {
    add('sem-secoes', 'texto longo sem seções (títulos ## ou ###)')
  }

  const definicao = /^\*\*[^*]+?\*\*\s*:|^\*\*[^*]+?:\s*\*\*/
  let seguidas = 0
  let maior = 0
  for (const b of blocos) {
    seguidas = definicao.test(b) ? seguidas + 1 : 0
    maior = Math.max(maior, seguidas)
  }
  if (maior >= 3) {
    add(
      'definicoes-em-paragrafos',
      'itens definidos em parágrafos soltos (**Termo:** …): usar lista ou tabela',
    )
  }

  const imagens = [...markdown.matchAll(/!\[([^\]]*)\]\([^)]*\)/g)]
  const semAlt = imagens.filter((m) => altVazioOuGenerico(m[1] ?? '')).length
  if (semAlt > 0) {
    add(
      'imagem-sem-alt',
      `${semAlt} imagem(ns) sem texto alternativo útil (use npm run alt-texto)`,
    )
  }

  if (/\b(figura|imagem|print|tela)s?\s+(abaixo|acima)\b/i.test(markdown)) {
    add(
      'figura-por-posicao',
      'referência a figura por posição ("figura abaixo"): citar a tela pelo nome',
    )
  }

  if (/^como\b/i.test(titulo.trim()) && !/^\d+[.)]\s/m.test(markdown)) {
    add(
      'procedimento-sem-passos',
      'título de procedimento ("Como…") sem passo a passo numerado',
    )
  }

  const caixaAlta = new Set(
    markdown.replace(/`[^`]*`|\]\([^)]*\)/g, '').match(/\b[A-ZÀ-Ý]{5,}\b/g) ??
      [],
  )
  if (caixaAlta.size >= 3) {
    add(
      'caixa-alta',
      `estados ou opções em CAIXA ALTA (${[...caixaAlta].slice(0, 3).join(', ')}…): usar negrito ou tabela`,
    )
  }

  const ultimo = texto[texto.length - 1] ?? ''
  const inicio = texto.slice(0, 2).join(' ')
  const exige = /(deve|dever[áa]|precisa|[ée] necess[áa]rio|somente|apenas)/i
  const requisito = /(m[óo]dulo|licen[çc]a|permiss[ãa]o)/i
  if (
    texto.length >= 3 &&
    exige.test(ultimo) &&
    requisito.test(ultimo) &&
    !requisito.test(inicio)
  ) {
    add(
      'pre-requisito-no-fim',
      'pré-requisito (módulo, licença ou permissão) só aparece no fim: levar para "Antes de começar"',
    )
  }
  return saida
}
