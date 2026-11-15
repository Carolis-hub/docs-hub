/** Trecho de uma linha de Markdown. */
export type TrechoMd =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; trechos: TrechoMd[] }
  | { tipo: 'italico'; trechos: TrechoMd[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; url: string; trechos: TrechoMd[] }

export type BlocoMd =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; trechos: TrechoMd[] }
  | { tipo: 'paragrafo'; trechos: TrechoMd[] }
  | { tipo: 'lista'; ordenada: boolean; itens: TrechoMd[][] }
  | {
      tipo: 'tabela'
      /** Vazio quando a tabela não tem a linha de traços depois do cabeçalho. */
      cabecalho: TrechoMd[][]
      linhas: TrechoMd[][][]
    }

const PONTUACAO = '\\`*_{}[]()#+-.!|~>"\'<&'

/** Só http(s), mailto e caminhos do próprio sistema viram link. */
export function urlPermitida(url: string): string {
  const u = url.trim()
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u
  return /^\/(?!\/)/.test(u) ? u : ''
}

function juntar(trechos: TrechoMd[]): TrechoMd[] {
  const saida: TrechoMd[] = []
  for (const t of trechos) {
    const ultimo = saida[saida.length - 1]
    if (t.tipo === 'texto' && ultimo?.tipo === 'texto') {
      saida[saida.length - 1] = { tipo: 'texto', texto: ultimo.texto + t.texto }
    } else if (t.tipo !== 'texto' || t.texto) saida.push(t)
  }
  return saida
}

/** Posição do `fim` que fecha, ignorando os escapados com `\`. */
function acharFim(s: string, fim: string, de: number): number {
  for (let i = de; i < s.length; i++) {
    if (s[i] === '\\') i++
    else if (s.startsWith(fim, i)) return i
  }
  return -1
}

/**
 * Lê **negrito**, *itálico*, `código`, [texto](url) e escapes (`\*`, `\[`…).
 * Nada vira HTML: o resultado é uma estrutura que o React desenha como texto.
 */
export function trechosMd(linha: string, profundidade = 0): TrechoMd[] {
  const saida: TrechoMd[] = []
  let texto = ''
  const solta = () => {
    if (texto) saida.push({ tipo: 'texto', texto })
    texto = ''
  }
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i] as string
    if (
      c === '\\' &&
      i + 1 < linha.length &&
      PONTUACAO.includes(linha[i + 1] as string)
    ) {
      texto += linha[++i]
      continue
    }
    if (profundidade < 4) {
      if (c === '`') {
        const f = linha.indexOf('`', i + 1)
        if (f > i + 1) {
          solta()
          saida.push({ tipo: 'codigo', texto: linha.slice(i + 1, f) })
          i = f
          continue
        }
      } else if (linha.startsWith('**', i)) {
        const f = acharFim(linha, '**', i + 2)
        if (f > i + 2) {
          solta()
          saida.push({
            tipo: 'negrito',
            trechos: trechosMd(linha.slice(i + 2, f), profundidade + 1),
          })
          i = f + 1
          continue
        }
      } else if (c === '*') {
        const f = acharFim(linha, '*', i + 1)
        if (f > i + 1) {
          solta()
          saida.push({
            tipo: 'italico',
            trechos: trechosMd(linha.slice(i + 1, f), profundidade + 1),
          })
          i = f
          continue
        }
      } else if (c === '[') {
        const fimTexto = acharFim(linha, ']', i + 1)
        if (fimTexto > 0 && linha[fimTexto + 1] === '(') {
          const fimUrl = linha.indexOf(')', fimTexto + 2)
          if (fimUrl > 0) {
            const url = urlPermitida(
              linha.slice(fimTexto + 2, fimUrl).replace(/\\(.)/g, '$1'),
            )
            const dentro = linha.slice(i + 1, fimTexto)
            solta()
            if (url) {
              saida.push({
                tipo: 'link',
                url,
                trechos: trechosMd(dentro, profundidade + 1),
              })
            } else {
              // Endereço não permitido: fica só o texto, sem link.
              saida.push(...trechosMd(dentro, profundidade + 1))
            }
            i = fimUrl
            continue
          }
        }
      }
    }
    texto += c
  }
  solta()
  return juntar(saida)
}

/** Células de uma linha de tabela (`| a | b |`); `\\|` é uma barra dentro da célula. */
function celulas(linha: string): string[] {
  const partes: string[] = []
  let atual = ''
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i] as string
    if (c === '\\' && i + 1 < linha.length) atual += c + linha[++i]
    else if (c === '|') {
      partes.push(atual)
      atual = ''
    } else atual += c
  }
  partes.push(atual)
  // As barras das pontas não criam células.
  return partes.slice(1, linha.endsWith('|') ? -1 : undefined)
}

/** A linha de traços que separa o cabeçalho: `| --- | :---: |`. */
const ehSeparador = (linha: string) => {
  const cs = celulas(linha)
  return cs.length > 0 && cs.every((c) => /^\s*:?-+:?\s*$/.test(c))
}

/** Monta a tabela; todas as linhas ficam com o mesmo número de células. */
function montarTabela(linhas: string[]): BlocoMd {
  const temCabecalho = linhas.length > 1 && ehSeparador(linhas[1] as string)
  const brutas = linhas
    .filter((_, i) => !(temCabecalho && i === 1))
    .map(celulas)
  const largura = Math.max(...brutas.map((l) => l.length))
  const prontas = brutas.map((l) =>
    Array.from({ length: largura }, (_, i) => trechosMd((l[i] ?? '').trim())),
  )
  return {
    tipo: 'tabela',
    cabecalho: temCabecalho ? (prontas[0] as TrechoMd[][]) : [],
    linhas: temCabecalho ? prontas.slice(1) : prontas,
  }
}

/**
 * Lê parágrafos, títulos (#), listas (`-`, `*`, `1.`), tabelas (linhas que
 * começam com `|`) e quebras de linha simples.
 */
export function lerMarkdown(md: string): BlocoMd[] {
  const blocos: BlocoMd[] = []
  let paragrafo: string[] = []
  let lista: { ordenada: boolean; itens: TrechoMd[][] } | null = null
  let tabela: string[] = []
  const fecharTabela = () => {
    if (tabela.length) {
      blocos.push(montarTabela(tabela))
      tabela = []
    }
  }
  const fecharParagrafo = () => {
    if (paragrafo.length) {
      blocos.push({
        tipo: 'paragrafo',
        trechos: trechosMd(paragrafo.join(' ')),
      })
      paragrafo = []
    }
  }
  const fecharLista = () => {
    if (lista) {
      blocos.push({ tipo: 'lista', ...lista })
      lista = null
    }
  }
  for (const bruta of md.replace(/\r\n?/g, '\n').split('\n')) {
    const linha = bruta.trim()
    const titulo = /^(#{1,3})\s+(.+)$/.exec(linha)
    const item = /^(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/.exec(linha)
    if (linha.startsWith('|')) {
      fecharParagrafo()
      fecharLista()
      tabela.push(linha)
      continue
    }
    fecharTabela()
    if (!linha) {
      fecharParagrafo()
      fecharLista()
    } else if (titulo) {
      fecharParagrafo()
      fecharLista()
      blocos.push({
        tipo: 'titulo',
        nivel: (titulo[1] as string).length as 1 | 2 | 3,
        trechos: trechosMd(titulo[2] as string),
      })
    } else if (item) {
      fecharParagrafo()
      const ordenada = item[2] !== undefined
      if (lista && lista.ordenada !== ordenada) fecharLista()
      lista ??= { ordenada, itens: [] }
      lista.itens.push(trechosMd(item[3] ?? ''))
    } else {
      fecharLista()
      paragrafo.push(linha)
    }
  }
  fecharParagrafo()
  fecharLista()
  fecharTabela()
  return blocos
}
