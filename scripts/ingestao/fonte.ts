import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { lerFrontMatter } from '../migrate/adaptadores/smartshare-kb.ts'

/** Formatos lidos pela ingestão. `.docx` e `.pdf` ficam para uma etapa futura. */
const FORMATOS = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.txt': 'texto',
} as const
export type FormatoFonte = (typeof FORMATOS)[keyof typeof FORMATOS]

const PASTAS_IGNORADAS = new Set(['node_modules', '.git'])

export interface ArquivoFonte {
  /** Caminho relativo à pasta de origem, com `/`. */
  caminho: string
  formato: FormatoFonte
  /** Data de modificação do arquivo (ms). */
  modificadoEm: number
  tamanho: number
}

export interface VarreduraFonte {
  arquivos: ArquivoFonte[]
  /** Arquivos que a ingestão não lê (formato sem suporte), para o relatório. */
  ignorados: Array<{ caminho: string; motivo: string }>
}

/** Percorre a pasta e separa o que dá para ler do que fica de fora. */
export async function varrer(pasta: string): Promise<VarreduraFonte> {
  const saida: VarreduraFonte = { arquivos: [], ignorados: [] }
  async function visitar(dir: string, rel: string) {
    const itens = await readdir(dir, { withFileTypes: true })
    for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
      const relItem = rel ? `${rel}/${item.name}` : item.name
      if (item.isDirectory()) {
        if (item.name.startsWith('.') || PASTAS_IGNORADAS.has(item.name))
          continue
        await visitar(path.join(dir, item.name), relItem)
      } else if (item.isFile()) {
        if (item.name.startsWith('.')) continue
        const ext = path.extname(item.name).toLowerCase()
        const formato = (FORMATOS as Record<string, FormatoFonte>)[ext]
        if (!formato) {
          saida.ignorados.push({
            caminho: relItem,
            motivo: ['.docx', '.pdf'].includes(ext)
              ? `formato ${ext} ainda não é lido pela ingestão`
              : `extensão ${ext || '(sem extensão)'} sem suporte`,
          })
          continue
        }
        const info = await stat(path.join(dir, item.name))
        saida.arquivos.push({
          caminho: relItem,
          formato,
          modificadoEm: info.mtimeMs,
          tamanho: info.size,
        })
      }
    }
  }
  await visitar(pasta, '')
  return saida
}

/** Texto do arquivo em UTF-8, sem BOM e com quebras de linha `\n`. */
export async function lerTexto(
  pasta: string,
  caminho: string,
): Promise<string> {
  const bruto = await readFile(path.join(pasta, caminho), 'utf8')
  return bruto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/** Hash do conteúdo, imune a diferenças de quebra de linha e espaços nas pontas. */
export function hashDoConteudo(texto: string): string {
  return createHash('sha256').update(texto.trim()).digest('hex')
}

const humanizar = (nome: string) => {
  const t = nome.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : nome
}

export const nomeDaPasta = humanizar

const escapar = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export interface DocumentoLido {
  titulo: string
  /** Conteúdo pronto para o conversor do importador. */
  conteudo: string
  formato: 'markdown' | 'html'
  /** Texto para a classificação (sem front matter nem marcação de HTML). */
  texto: string
}

/**
 * Extrai o título e prepara o conteúdo: tira o front matter e o H1 repetido do
 * Markdown, o `<body>` do HTML e transforma texto puro em parágrafos.
 */
export function prepararDocumento(
  fonte: string,
  formato: FormatoFonte,
  caminho: string,
): DocumentoLido {
  const nomeArquivo = humanizar(
    path.posix.basename(caminho, path.extname(caminho)),
  )

  if (formato === 'markdown') {
    const { meta, corpo } = lerFrontMatter(fonte)
    const h1 = /^\s*#\s+(.+)$/m.exec(corpo)?.[1]?.trim()
    const titulo = meta.titulo || meta.title || h1 || nomeArquivo
    let texto = corpo.replace(/^\s*#\s+(.+)\n?/, (inteiro, t: string) =>
      t.trim() === titulo ? '' : inteiro,
    )
    // O editor só tem H1 a H3.
    texto = texto.replace(/^(#{4,6})\s/gm, '### ').trim() + '\n'
    return { titulo, conteudo: texto, formato: 'markdown', texto }
  }

  if (formato === 'html') {
    const titulo =
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
        .exec(fonte)?.[1]
        ?.replace(/<[^>]+>/g, '')
        .trim() ||
      /<title[^>]*>([\s\S]*?)<\/title>/i.exec(fonte)?.[1]?.trim() ||
      nomeArquivo
    const corpo = /<body[^>]*>([\s\S]*)<\/body>/i.exec(fonte)?.[1] ?? fonte
    return {
      titulo,
      conteudo: corpo,
      formato: 'html',
      texto: corpo
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    }
  }

  const paragrafos = fonte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const primeira = paragrafos[0]?.split('\n')[0]?.trim() ?? ''
  const titulo = primeira && primeira.length <= 100 ? primeira : nomeArquivo
  return {
    titulo,
    conteudo: paragrafos
      .map((p) => `<p>${escapar(p).replace(/\n/g, '<br>')}</p>`)
      .join('\n'),
    formato: 'html',
    texto: fonte,
  }
}
