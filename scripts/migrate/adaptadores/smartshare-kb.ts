import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import type { Manifesto, ManifestoArtigo, ManifestoBloco } from '../types.ts'

/**
 * Adaptador da base do SmartShare (docs.selbetti.com.br).
 *
 * Lê a pasta `kb/` gerada por `smartshare-kb/scripts/extrair_kb.py` e escreve
 * uma exportação no formato neutro do importador (manifesto.json + artigos).
 */

export interface OpcoesKb {
  /** Artigos cujo `categoria_caminho` casa com esta expressão viram "técnico". */
  tecnico?: RegExp
  /** Por padrão artigos `descontinuado` entram como rascunho. */
  publicarDescontinuados?: boolean
  /** Mantém blocos sem artigos (por padrão são descartados, com aviso). */
  manterVazios?: boolean
  /** Converte só estes artigos (ids do site) e os blocos que levam até eles. */
  apenas?: string[]
}

export interface ResultadoKb {
  manifesto: Manifesto
  /** Caminho de saída (relativo) → conteúdo Markdown. */
  arquivos: Map<string, string>
  avisos: string[]
}

type FrontMatter = Record<string, string>

function valorYaml(bruto: string): string {
  const v = bruto.trim()
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    return v.slice(1, -1).replace(/\\\\/g, '\\')
  }
  return v
}

/** Separa o front matter (formato simples `chave: valor`) do corpo. */
export function lerFrontMatter(texto: string): {
  meta: FrontMatter
  corpo: string
} {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto)
  if (!m) return { meta: {}, corpo: texto }
  const meta: FrontMatter = {}
  for (const linha of (m[1] ?? '').split(/\r?\n/)) {
    const i = linha.indexOf(':')
    if (i > 0) meta[linha.slice(0, i).trim()] = valorYaml(linha.slice(i + 1))
  }
  return { meta, corpo: texto.slice(m[0].length) }
}

/** URL do site sem hash, query e barra final, para casar links entre artigos. */
export function normalizarUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return url
  }
}

/**
 * Ajusta o corpo para o editor: remove o H1 repetido do título, limita os
 * títulos a H3, tira o prefixo "IMG:" do texto alternativo e troca links do
 * site antigo para `artigo:<id>`.
 */
/** Linha que só tem uma imagem cujo arquivo se chama "branco" (espaçador do site). */
const ESPACADOR =
  /^[ \t]*!\[[^\]]*\]\([^)\s]*\/[^/)\s]*branco[^/)\s]*\)[ \t]*$/gim

export function ajustarCorpo(
  corpo: string,
  titulo: string,
  idPorUrl: Map<string, string>,
): string {
  let texto = corpo.replace(/^\s*#\s+(.+)\r?\n/, (inteiro, h1: string) =>
    h1.trim() === titulo.trim() ? '' : inteiro,
  )
  // O site usa imagens em branco ("Branco.png", "Espaço-Branco.png"…) como
  // espaçadores entre parágrafos. No editor viram imagens sem sentido.
  texto = texto.replace(ESPACADOR, '').replace(/\n{3,}/g, '\n\n')
  texto = texto.replace(/^(#{4,6})\s/gm, '### ')
  texto = texto.replace(
    /!\[IMG:\s*([^\]]*)\]/g,
    (_m, alt: string) => `![${alt.trim()}]`,
  )
  texto = texto.replace(
    /(?<!!)\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    (m, rotulo: string, url: string) => {
      const id = idPorUrl.get(normalizarUrl(url))
      return id ? `[${rotulo}](artigo:${id})` : m
    },
  )
  return texto.trim() + '\n'
}

async function listar(dir: string): Promise<string[]> {
  const itens = await readdir(dir, { withFileTypes: true })
  return itens.map((i) => i.name).sort()
}

export async function converterKb(
  pastaKb: string,
  opcoes: OpcoesKb = {},
): Promise<ResultadoKb> {
  const blocos: ManifestoBloco[] = []
  const artigos: ManifestoArtigo[] = []
  const arquivos = new Map<string, string>()
  const avisos: string[] = []
  const pendentes: Array<{ id: string; titulo: string; corpo: string }> = []
  const idPorUrl = new Map<string, string>()

  async function visitar(dir: string, rel: string, pai: string | null) {
    const nomes = await listar(dir)
    let nomeBloco = path.posix.basename(rel)
    if (nomes.includes('_index.md')) {
      const { meta } = lerFrontMatter(
        await readFile(path.join(dir, '_index.md'), 'utf8'),
      )
      nomeBloco = meta.categoria || nomeBloco
    } else {
      avisos.push(`pasta sem _index.md: ${rel}`)
    }
    blocos.push({
      id: rel,
      nome: nomeBloco,
      ...(pai ? { pai } : {}),
      ordem: blocos.filter((b) => (b.pai ?? null) === pai).length,
    })

    for (const nome of nomes) {
      const completo = path.join(dir, nome)
      if (nome === '_index.md') continue
      if (
        (await readdir(completo, { withFileTypes: true }).catch(() => null)) !==
        null
      ) {
        await visitar(completo, `${rel}/${nome}`, rel)
        continue
      }
      if (!nome.endsWith('.md')) continue
      const { meta, corpo } = lerFrontMatter(await readFile(completo, 'utf8'))
      const id = meta.id
      if (!id || !meta.titulo) {
        avisos.push(`artigo sem id ou titulo, ignorado: ${rel}/${nome}`)
        continue
      }
      if (meta.url) idPorUrl.set(normalizarUrl(meta.url), id)
      const descontinuado = meta.status === 'descontinuado'
      const arquivo = `artigos/${id}.md`
      pendentes.push({ id, titulo: meta.titulo, corpo })
      artigos.push({
        id,
        bloco: rel,
        titulo: meta.titulo,
        arquivo,
        formato: 'markdown',
        publico: opcoes.tecnico?.test(meta.categoria_caminho ?? '')
          ? 'tecnico'
          : 'usuario',
        publicado: descontinuado ? !!opcoes.publicarDescontinuados : true,
        ...(meta.atualizado_em ? { atualizadoEm: meta.atualizado_em } : {}),
      })
    }
  }

  for (const raiz of await listar(pastaKb)) {
    const completo = path.join(pastaKb, raiz)
    if (
      (await readdir(completo, { withFileTypes: true }).catch(() => null)) ===
      null
    )
      continue
    await visitar(completo, raiz, null)
  }

  // Os links entre artigos só podem ser resolvidos depois de ler todas as URLs.
  for (const p of pendentes) {
    arquivos.set(
      `artigos/${p.id}.md`,
      ajustarCorpo(p.corpo, p.titulo, idPorUrl),
    )
  }
  let blocosFinais = blocos
  let artigosFinais = artigos
  if (opcoes.apenas) {
    const quer = new Set(opcoes.apenas)
    artigosFinais = artigos.filter((a) => quer.has(a.id))
    for (const id of quer) {
      if (!artigosFinais.some((a) => a.id === id))
        avisos.push(`artigo ${id} não encontrado`)
    }
    for (const [rel] of arquivos) {
      if (!artigosFinais.some((a) => rel === `artigos/${a.id}.md`))
        arquivos.delete(rel)
    }
  }
  // Blocos sem nenhum artigo (nem nos descendentes) são lixo do site, como a
  // categoria "teste". Com `apenas`, só ficam os blocos que levam aos artigos.
  if (!opcoes.manterVazios || opcoes.apenas) {
    const usados = new Set<string>()
    const paiDe = new Map(blocos.map((b) => [b.id, b.pai ?? null]))
    for (const a of artigosFinais) {
      for (
        let b: string | null = a.bloco;
        b && !usados.has(b);
        b = paiDe.get(b) ?? null
      )
        usados.add(b)
    }
    blocosFinais = blocos.filter((b) => usados.has(b.id))
    if (!opcoes.apenas) {
      for (const b of blocos) {
        if (!usados.has(b.id))
          avisos.push(`bloco sem artigos descartado: ${b.nome} (${b.id})`)
      }
    }
  }
  return {
    manifesto: { blocos: blocosFinais, artigos: artigosFinais },
    arquivos,
    avisos,
  }
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      tecnico: { type: 'string' },
      'publicar-descontinuados': { type: 'boolean', default: false },
      'manter-vazios': { type: 'boolean', default: false },
      apenas: { type: 'string' },
    },
  })
  const [origem, saida] = positionals
  if (!origem || !saida) {
    console.log(
      'Uso: node scripts/migrate/adaptadores/smartshare-kb.ts <pasta-smartshare-kb> <pasta-saida>\n' +
        '       [--tecnico <regex sobre a categoria>] [--publicar-descontinuados]\n' +
        '       [--manter-vazios] [--apenas <id,id,…>]',
    )
    return 2
  }
  const r = await converterKb(path.join(origem, 'kb'), {
    tecnico: values.tecnico ? new RegExp(values.tecnico, 'i') : undefined,
    publicarDescontinuados: values['publicar-descontinuados'],
    manterVazios: values['manter-vazios'],
    apenas: values.apenas
      ?.split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  })
  await mkdir(path.join(saida, 'artigos'), { recursive: true })
  await writeFile(
    path.join(saida, 'manifesto.json'),
    JSON.stringify(r.manifesto, null, 2),
  )
  for (const [rel, conteudo] of r.arquivos)
    await writeFile(path.join(saida, rel), conteudo)
  r.avisos.forEach((a) => console.warn(`aviso: ${a}`))
  console.log(
    `Exportação neutra: ${r.manifesto.blocos.length} blocos, ${r.manifesto.artigos.length} artigos em ${saida}`,
  )
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (c) => process.exit(c),
    (e) => {
      console.error(e)
      process.exit(1)
    },
  )
}
