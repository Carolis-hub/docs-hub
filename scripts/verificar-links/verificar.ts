import type { JSONContent } from '@tiptap/react'
import { extrairImagens, extrairLinks } from '../../src/utils/content.ts'

export type EstadoUrl =
  { estado: 'ok' } | { estado: 'quebrado' | 'inconclusivo'; motivo: string }

export interface ArtigoParaVerificar {
  id: string
  titulo: string
  status: 'draft' | 'published'
  conteudo: JSONContent
}

export interface Achado {
  artigoId: string
  titulo: string
  tipo: 'link' | 'imagem'
  alvo: string
  motivo: string
}

export interface RelatorioLinks {
  artigosVerificados: number
  urlsVerificadas: number
  quebrados: Achado[]
  inconclusivos: Achado[]
}

export interface DepsVerificacao {
  /** Ids de todos os artigos, com o status. */
  artigos: Map<string, 'draft' | 'published'>
  /** Ids de todos os blocos. */
  blocos: Set<string>
  /** Confere uma URL externa. Omitir pula as externas. */
  checarUrl?: (url: string) => Promise<EstadoUrl>
  concorrencia?: number
}

/** Executa as tarefas com no máximo `limite` em paralelo. */
export async function emParalelo<T>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<void>,
): Promise<void> {
  let proximo = 0
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (proximo < itens.length) await tarefa(itens[proximo++] as T)
    },
  )
  await Promise.all(trabalhadores)
}

/** Resultado de uma checagem interna (sem rede): `null` quando está tudo certo. */
export function motivoInterno(
  href: string,
  deps: DepsVerificacao,
): string | null {
  const m = /^\/(a|b)\/([^/?#]+)/.exec(href)
  if (m) {
    const [, tipo, id] = m as unknown as [string, 'a' | 'b', string]
    if (tipo === 'b')
      return deps.blocos.has(id) ? null : 'o bloco não existe mais'
    const status = deps.artigos.get(id)
    if (!status) return 'o artigo não existe mais'
    return status === 'published' ? null : 'o artigo está em rascunho'
  }
  if (href.startsWith('#')) return 'âncora interna não suportada'
  return 'link relativo que não aponta para nenhuma página do docs-hub'
}

const EXTERNO = /^https?:\/\//i
const IGNORADO = /^(mailto:|tel:)/i

export async function verificarArtigos(
  artigos: ArtigoParaVerificar[],
  deps: DepsVerificacao,
): Promise<RelatorioLinks> {
  const publicados = artigos.filter((a) => a.status === 'published')
  const relatorio: RelatorioLinks = {
    artigosVerificados: publicados.length,
    urlsVerificadas: 0,
    quebrados: [],
    inconclusivos: [],
  }
  const externos: Array<{
    artigo: ArtigoParaVerificar
    tipo: Achado['tipo']
    url: string
  }> = []

  for (const artigo of publicados) {
    const alvos: Array<[Achado['tipo'], string]> = [
      ...extrairLinks(artigo.conteudo).map((u): [Achado['tipo'], string] => [
        'link',
        u,
      ]),
      ...extrairImagens(artigo.conteudo).map((u): [Achado['tipo'], string] => [
        'imagem',
        u,
      ]),
    ]
    for (const [tipo, url] of alvos) {
      if (IGNORADO.test(url)) continue
      if (EXTERNO.test(url)) {
        externos.push({ artigo, tipo, url })
        continue
      }
      const motivo =
        tipo === 'link'
          ? motivoInterno(url, deps)
          : 'imagem com endereço relativo'
      if (motivo) {
        relatorio.quebrados.push({
          artigoId: artigo.id,
          titulo: artigo.titulo,
          tipo,
          alvo: url,
          motivo,
        })
      }
    }
  }

  if (deps.checarUrl) {
    const checar = deps.checarUrl
    const unicas = [...new Set(externos.map((e) => e.url))]
    relatorio.urlsVerificadas = unicas.length
    const resultados = new Map<string, EstadoUrl>()
    await emParalelo(unicas, deps.concorrencia ?? 6, async (url) => {
      resultados.set(url, await checar(url))
    })
    for (const { artigo, tipo, url } of externos) {
      const r = resultados.get(url)
      if (!r || r.estado === 'ok') continue
      const achado = {
        artigoId: artigo.id,
        titulo: artigo.titulo,
        tipo,
        alvo: url,
        motivo: r.motivo,
      }
      ;(r.estado === 'quebrado'
        ? relatorio.quebrados
        : relatorio.inconclusivos
      ).push(achado)
    }
  }
  return relatorio
}

export function relatorioEmMarkdown(r: RelatorioLinks): string {
  const tabela = (achados: Achado[]) =>
    achados.length === 0
      ? 'Nenhum.\n'
      : ['| Artigo | Tipo | Endereço | Motivo |', '|---|---|---|---|']
          .concat(
            achados.map(
              (a) =>
                `| [${a.titulo.replace(/\|/g, '/')}](/a/${a.artigoId}) | ${a.tipo} | ${a.alvo} | ${a.motivo} |`,
            ),
          )
          .join('\n') + '\n'
  return [
    '# Verificação de links',
    '',
    `- Artigos publicados verificados: ${r.artigosVerificados}`,
    `- Endereços externos verificados: ${r.urlsVerificadas}`,
    `- Quebrados: ${r.quebrados.length}`,
    `- Inconclusivos: ${r.inconclusivos.length}`,
    '',
    `## Quebrados (${r.quebrados.length})`,
    '',
    tabela(r.quebrados),
    `## Inconclusivos (${r.inconclusivos.length})`,
    '',
    'Sites que bloqueiam robôs (403, 429), ou que não responderam: confira à mão.',
    '',
    tabela(r.inconclusivos),
  ].join('\n')
}
