import type { Ficha, SecaoFicha } from '../types/content'

export const LIMITES_FICHA = {
  secoes: 5,
  colunas: 12,
  linhas: 60,
  itens: 40,
  titulo: 120,
  texto: 4000,
  celula: 120,
  url: 500,
} as const

export type TipoSecao = SecaoFicha['tipo']

/** As 5 opções do produto: fixas (não se adiciona, remove, renomeia nem reordena). */
export const OPCOES_FIXAS: ReadonlyArray<{
  id: string
  titulo: string
  tipo: TipoSecao
}> = [
  { id: 'compatibilidade-di', titulo: 'Compatibilidade DI', tipo: 'tabela' },
  {
    id: 'compatibilidade-smartshare',
    titulo: 'Compatibilidade SmartShare',
    tipo: 'tabela',
  },
  {
    id: 'instaladores-e-aplicativos',
    titulo: 'Instaladores e Aplicativos',
    tipo: 'links',
  },
  { id: 'release-notes', titulo: 'Release Notes', tipo: 'links' },
  { id: 'contato', titulo: 'Contato', tipo: 'links' },
]

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

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Texto de apoio e colunas iniciais de cada opção (antes de alguém editar). */
function padraoDe(id: string): {
  texto: string
  colunas: string[]
} {
  switch (id) {
    case 'compatibilidade-di':
      return {
        texto:
          'Em **negrito** estão destacadas as versões do DI homologadas em conjunto com o SmartShare correspondente. Sempre que possível, recomenda-se manter o DI atualizado com a mesma versão do SmartShare em que foi homologado. No entanto, o DI mantém retrocompatibilidade com versões anteriores do SmartShare Clássico, mantendo seu funcionamento mesmo em ambientes não atualizados.',
        colunas: [
          'SmartShare',
          'DI Client',
          'DI Server',
          'WS DI Server',
          'WS DI Client',
        ],
      }
    case 'compatibilidade-smartshare':
      return {
        texto:
          'Em **negrito** estão destacadas versões que se tornaram dependentes. Mantenha sempre o SmartShare atualizado.',
        colunas: [
          'SmartShare Clássico',
          'SmartShare 4',
          'SmartSigner',
          'SmartShare 2.0 (Mobile)',
        ],
      }
    case 'instaladores-e-aplicativos':
      return {
        texto:
          'Acesse o portal de softwares para ter acesso aos instaladores e aplicativos. Não encontrou o que procurava? Entre em contato conosco.',
        colunas: [],
      }
    case 'release-notes':
      return {
        texto:
          'Acompanhe as últimas liberações, com novas funcionalidades, melhorias e correções. Se tem alguma dúvida sobre as atualizações, entre em contato conosco.',
        colunas: [],
      }
    default:
      return {
        texto:
          'Não encontrou o que procurava? Envie uma mensagem para que possamos entender sua dúvida e atender o mais breve possível.',
        colunas: [],
      }
  }
}

/**
 * Sempre devolve as 5 opções fixas, na ordem fixa. O que estiver salvo (casado
 * pelo id ou pelo título) preenche o conteúdo; o resto vem do padrão.
 */
export function completarFicha(ficha?: Ficha | null): Ficha {
  const salvas = ficha?.secoes ?? []
  const secoes = OPCOES_FIXAS.map((o): SecaoFicha => {
    const salva = salvas.find(
      (s) => s.id === o.id || semAcento(s.titulo) === semAcento(o.titulo),
    )
    const padrao = padraoDe(o.id)
    const texto = salva ? salva.texto : padrao.texto
    if (o.tipo === 'tabela') {
      const t = salva?.tipo === 'tabela' ? salva : null
      return {
        id: o.id,
        tipo: 'tabela',
        titulo: o.titulo,
        texto,
        colunas: t ? t.colunas : padrao.colunas,
        linhas: t ? t.linhas : [],
      }
    }
    const l = salva?.tipo === 'links' ? salva : null
    return {
      id: o.id,
      tipo: 'links',
      titulo: o.titulo,
      texto,
      itens: l ? l.itens : [],
    }
  })
  return { secoes }
}

/** Limpa e limita o conteúdo das 5 opções fixas antes de gravar. */
export function normalizarFicha(ficha: Ficha): Ficha {
  const L = LIMITES_FICHA
  const secoes = completarFicha(ficha).secoes.map((s): SecaoFicha => {
    const texto = corta(s.texto, L.texto)
    if (s.tipo === 'tabela') {
      const colunas = s.colunas
        .slice(0, L.colunas)
        .map((c) => corta(c, L.celula))
      const linhas = s.linhas
        .slice(0, L.linhas)
        .map((l) => colunas.map((_, i) => corta(l[i] ?? '', L.celula)))
      return { ...s, texto, colunas, linhas }
    }
    if (s.tipo === 'links') {
      const itens = s.itens
        .slice(0, L.itens)
        .map((i) => ({
          rotulo: corta(i.rotulo, L.celula),
          url: urlSegura(corta(i.url, L.url)),
        }))
        .filter((i) => i.rotulo)
      return { ...s, texto, itens }
    }
    return { ...s, texto }
  })
  return { secoes }
}
