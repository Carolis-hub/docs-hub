import type { Ficha, SecaoFicha } from '../types/content'

export const LIMITES_FICHA = {
  secoes: 20,
  colunas: 12,
  linhas: 60,
  itens: 40,
  titulo: 120,
  texto: 4000,
  celula: 120,
  url: 500,
} as const

export type TipoSecao = SecaoFicha['tipo']

let contador = 0
export const novoIdDeSecao = () =>
  `s${Date.now().toString(36)}${(contador++).toString(36)}`

export function secaoVazia(tipo: TipoSecao): SecaoFicha {
  const base = { id: novoIdDeSecao(), titulo: '', texto: '' }
  if (tipo === 'tabela') {
    return { ...base, tipo, colunas: ['Coluna 1', 'Coluna 2'], linhas: [] }
  }
  if (tipo === 'links') return { ...base, tipo, itens: [] }
  return { ...base, tipo }
}

/** Tabela em texto: primeira linha são as colunas; células separadas por "|". */
export function tabelaParaTexto(colunas: string[], linhas: string[][]): string {
  return [colunas, ...linhas].map((l) => l.join(' | ')).join('\n')
}

export function textoParaTabela(texto: string): {
  colunas: string[]
  linhas: string[][]
} {
  const todas = texto
    .split(/\r?\n/)
    .map((l) => l.split('|').map((c) => c.trim()))
    .filter((l) => l.some((c) => c !== ''))
  const colunas = todas[0] ?? []
  // Linha com menos células é completada; com mais, o excedente é descartado.
  const linhas = todas.slice(1).map((l) => colunas.map((_, i) => l[i] ?? ''))
  return { colunas, linhas }
}

/** Links em texto: uma linha por item, "Rótulo | https://…" (o endereço é opcional). */
export function linksParaTexto(
  itens: { rotulo: string; url: string }[],
): string {
  return itens
    .map((i) => (i.url ? `${i.rotulo} | ${i.url}` : i.rotulo))
    .join('\n')
}

export function textoParaLinks(
  texto: string,
): { rotulo: string; url: string }[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('|')
      return i === -1
        ? { rotulo: l, url: '' }
        : { rotulo: l.slice(0, i).trim(), url: l.slice(i + 1).trim() }
    })
    .filter((i) => i.rotulo !== '')
}

/** A seção tem algo para mostrar ao leitor (texto, linhas ou links)? */
export function temConteudo(s: SecaoFicha): boolean {
  if (s.texto.trim()) return true
  if (s.tipo === 'tabela') return s.linhas.length > 0
  if (s.tipo === 'links') return s.itens.length > 0
  return false
}

/** Só endereços http(s) e mailto viram link; o resto é descartado. */
export function urlSegura(url: string): string {
  const u = url.trim()
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : ''
}

const corta = (t: string, max: number) => t.trim().slice(0, max)

/** Limpa e limita a ficha antes de gravar; seções sem nada são descartadas. */
export function normalizarFicha(ficha: Ficha): Ficha {
  const L = LIMITES_FICHA
  const secoes: SecaoFicha[] = []
  for (const s of ficha.secoes.slice(0, L.secoes)) {
    const titulo = corta(s.titulo, L.titulo)
    const texto = corta(s.texto, L.texto)
    if (s.tipo === 'tabela') {
      const colunas = s.colunas
        .slice(0, L.colunas)
        .map((c) => corta(c, L.celula))
      const linhas = s.linhas
        .slice(0, L.linhas)
        .map((l) => colunas.map((_, i) => corta(l[i] ?? '', L.celula)))
      if (!titulo && !texto && colunas.every((c) => !c)) continue
      secoes.push({ id: s.id, tipo: 'tabela', titulo, texto, colunas, linhas })
    } else if (s.tipo === 'links') {
      const itens = s.itens
        .slice(0, L.itens)
        .map((i) => ({
          rotulo: corta(i.rotulo, L.celula),
          url: urlSegura(corta(i.url, L.url)),
        }))
        .filter((i) => i.rotulo)
      if (!titulo && !texto && itens.length === 0) continue
      secoes.push({ id: s.id, tipo: 'links', titulo, texto, itens })
    } else {
      if (!titulo && !texto) continue
      secoes.push({ id: s.id, tipo: 'texto', titulo, texto })
    }
  }
  return { secoes }
}

export function moverSecao(ficha: Ficha, id: string, delta: -1 | 1): Ficha {
  const i = ficha.secoes.findIndex((s) => s.id === id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= ficha.secoes.length) return ficha
  const secoes = [...ficha.secoes]
  const [item] = secoes.splice(i, 1)
  secoes.splice(j, 0, item as SecaoFicha)
  return { secoes }
}

/** Estrutura inicial sugerida (compatibilidade, instaladores, release notes, contato). */
export function fichaModelo(): Ficha {
  return {
    secoes: [
      {
        id: novoIdDeSecao(),
        tipo: 'tabela',
        titulo: 'Compatibilidade DI',
        texto:
          'Em **negrito** estão destacadas as versões do DI homologadas em conjunto com o SmartShare correspondente. Sempre que possível, recomenda-se manter o DI atualizado com a mesma versão do SmartShare em que foi homologado. No entanto, o DI mantém retrocompatibilidade com versões anteriores do SmartShare Clássico, mantendo seu funcionamento mesmo em ambientes não atualizados.',
        colunas: [
          'SmartShare',
          'DI Client',
          'DI Server',
          'WS DI Server',
          'WS DI Client',
        ],
        linhas: [],
      },
      {
        id: novoIdDeSecao(),
        tipo: 'tabela',
        titulo: 'Compatibilidade SmartShare',
        texto:
          'Em **negrito** estão destacadas versões que se tornaram dependentes. Mantenha sempre o SmartShare atualizado.',
        colunas: [
          'SmartShare Clássico',
          'SmartShare 4',
          'SmartSigner',
          'SmartShare 2.0 (Mobile)',
        ],
        linhas: [],
      },
      {
        id: novoIdDeSecao(),
        tipo: 'links',
        titulo: 'Instaladores e Aplicativos',
        texto:
          'Acesse o portal de softwares para ter acesso aos instaladores e aplicativos. Não encontrou o que procurava? Entre em contato conosco.',
        itens: [{ rotulo: 'Portal de instaladores', url: '' }],
      },
      {
        id: novoIdDeSecao(),
        tipo: 'links',
        titulo: 'Release Notes',
        texto:
          'Acompanhe as últimas liberações, com novas funcionalidades, melhorias e correções. Se tem alguma dúvida sobre as atualizações, entre em contato conosco.',
        itens: [],
      },
      {
        id: novoIdDeSecao(),
        tipo: 'links',
        titulo: 'Contato',
        texto:
          'Não encontrou o que procurava? Envie uma mensagem para que possamos entender sua dúvida e atender o mais breve possível.',
        itens: [{ rotulo: 'Falar com o suporte', url: '' }],
      },
    ],
  }
}
