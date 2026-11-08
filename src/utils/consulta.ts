import { normalizar } from './search.ts'

/** Palavras que não ajudam a achar um artigo (já sem acento e minúsculas). */
const PALAVRAS_VAZIAS = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'por',
  'para',
  'pra',
  'com',
  'sem',
  'e',
  'ou',
  'que',
  'qual',
  'quais',
  'quem',
  'como',
  'onde',
  'quando',
  'e',
  'eh',
  'ser',
  'sao',
  'foi',
  'fazer',
  'faz',
  'tem',
  'ha',
  'significa',
  'serve',
  'funciona',
  'funcionamento',
  'explique',
  'explica',
  'me',
  'se',
  'isso',
  'isto',
  'esse',
  'essa',
  'este',
  'esta',
  'tipo',
  'sobre',
])

/** Pergunta do tipo "o que é X" / "para que serve X" / "explique X". */
export function ehPerguntaDeConceito(pergunta: string): boolean {
  return /\b(o que e|o que sao|que e um|que e uma|para que serve|pra que serve|qual a diferenca|o que significa|explique|explica)\b/.test(
    normalizar(pergunta),
  )
}

/**
 * Tira da pergunta as palavras comuns ("o que é um…"), que dominam a busca
 * quando a pergunta é longa. Devolve a pergunta original se nada sobrar.
 */
export function limparPergunta(pergunta: string): string {
  const palavras = pergunta
    .replace(/[?!.,;:()"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const uteis = palavras.filter((p) => !PALAVRAS_VAZIAS.has(normalizar(p)))
  return uteis.length > 0 ? uteis.join(' ') : pergunta.trim()
}

/**
 * Grupos de termos que, na documentação, costumam significar a mesma coisa.
 * Ajuste conforme o vocabulário dos seus produtos.
 */
export const GRUPOS_SINONIMOS: readonly (readonly string[])[] = [
  ['indice', 'metadado', 'campo', 'atributo'],
  ['selecao', 'lista de valores', 'lista', 'combo', 'opcoes'],
  ['consulta', 'pesquisa', 'busca', 'lookup'],
  ['publicar', 'publicacao', 'upload'],
  ['excluir', 'apagar', 'remover', 'deletar'],
  ['fluxo', 'processo', 'workflow'],
  ['tarefa', 'atividade'],
  ['permissao', 'acesso', 'perfil'],
]

/**
 * Consultas extras trocando um termo da pergunta por seus sinônimos, uma por
 * troca, para a busca achar artigos escritos com outro vocabulário.
 */
export function variantesComSinonimos(pergunta: string, maximo = 6): string[] {
  const limpa = limparPergunta(pergunta)
  const base = normalizar(limpa)
  const saida: string[] = []
  for (const grupo of GRUPOS_SINONIMOS) {
    const presente = grupo.find((t) =>
      new RegExp(`(^|\\s)${t}(s|es)?(\\s|$)`).test(base),
    )
    if (!presente) continue
    for (const alt of grupo) {
      if (alt === presente) continue
      saida.push(
        base.replace(
          new RegExp(`(^|\\s)${presente}(s|es)?(?=\\s|$)`),
          `$1${alt}`,
        ),
      )
    }
  }
  return [...new Set(saida)].slice(0, maximo)
}

/** Consultas de segurança montadas sem IA, para somar às que a IA sugerir. */
export function consultasLocais(pergunta: string): string[] {
  const limpa = limparPergunta(pergunta)
  return [...new Set([limpa, ...variantesComSinonimos(pergunta)])]
}
