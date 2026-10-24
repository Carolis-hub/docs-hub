import { createHash } from 'node:crypto'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import type { Article } from '../../src/types/content.ts'
import type { IndexedItem, SearchItem } from '../../src/types/search.ts'
import { criarMotor } from '../../src/utils/searchEngine.ts'
import type { ProvedorIA } from './ia.ts'
import { consultaDeBusca, type Regras } from './regras.ts'
import { gerarSugestao } from './sugestao.ts'

export interface OpcoesSync {
  /** Artigos explícitos (somam-se aos do front matter do arquivo). */
  artigos?: string[]
  /** Produto onde procurar artigos parecidos, quando nenhum for indicado. */
  produto?: string
  /** Quantos artigos candidatos considerar na busca automática. */
  maxCandidatos?: number
  /** Sem isto, a IA roda e o resultado é só relatado. */
  gravar: boolean
  /** Origem das regras, para rastrear (ex.: repositório e commit). */
  origem?: { repo?: string; commit?: string }
  agora: number
}

export type StatusArtigo =
  | 'criada'
  | 'simulada'
  | 'ja-existia'
  | 'nenhuma-mudanca'
  | 'artigo-nao-encontrado'
  | 'erro'

export interface ResultadoArtigo {
  artigoId: string
  automatico: boolean
  status: StatusArtigo
  detalhe?: string
}

export interface ResultadoRegras {
  regras: string
  resultados: ResultadoArtigo[]
  /** Aviso quando nenhum artigo foi achado para estas regras. */
  semArtigo?: string
}

/** Id estável: as mesmas regras sobre o mesmo artigo não geram sugestões repetidas. */
export function idDaSugestao(arquivo: string, hash: string): string {
  return createHash('sha1')
    .update(`${arquivo}\n${hash}`)
    .digest('hex')
    .slice(0, 20)
}

async function lerIndice(
  db: Firestore,
  produtos: string[],
): Promise<IndexedItem[]> {
  const itens: IndexedItem[] = []
  for (const productId of produtos) {
    const ref = db.collection('searchIndex').doc(productId)
    const principal = await ref.get()
    const dados = principal.data() as
      { itens?: SearchItem[]; dividido?: boolean } | undefined
    let lista = dados?.itens ?? []
    if (dados?.dividido) {
      const partes = await ref.collection('partes').get()
      lista = partes.docs.flatMap((p) => (p.data().itens as SearchItem[]) ?? [])
    }
    itens.push(...lista.map((i) => ({ ...i, productId })))
  }
  return itens
}

async function candidatos(
  db: Firestore,
  regras: Regras,
  opcoes: OpcoesSync,
): Promise<{ id: string; automatico: boolean }[]> {
  const explicitos = [
    ...new Set([...regras.artigos, ...(opcoes.artigos ?? [])]),
  ]
  if (explicitos.length > 0)
    return explicitos.map((id) => ({ id, automatico: false }))

  const produto = opcoes.produto ?? regras.produto
  let produtos: string[]
  if (produto) {
    produtos = [produto]
  } else {
    const raizes = await db
      .collection('blocks')
      .where('parentId', '==', null)
      .get()
    produtos = raizes.docs.map((d) => d.id)
  }
  const motor = criarMotor(await lerIndice(db, produtos), true)
  return motor
    .buscar(consultaDeBusca(regras), { combinar: 'OR' })
    .slice(0, opcoes.maxCandidatos ?? 3)
    .map((h) => ({ id: h.item.id, automatico: true }))
}

/**
 * Gera sugestões de atualização a partir de um arquivo de regras. Nunca
 * publica: só escreve em `articles/{id}/suggestions` e marca flags.
 */
export async function sincronizarRegras(
  db: Firestore,
  regras: Regras,
  provedor: ProvedorIA,
  opcoes: OpcoesSync,
): Promise<ResultadoRegras> {
  const alvos = await candidatos(db, regras, opcoes)
  const saida: ResultadoRegras = { regras: regras.arquivo, resultados: [] }
  if (alvos.length === 0) {
    saida.semArtigo =
      'nenhum artigo encontrado para estas regras; indique `artigos:` no arquivo ou crie o artigo antes'
    return saida
  }

  const sid = idDaSugestao(regras.arquivo, regras.hash)
  for (const { id, automatico } of alvos) {
    const base = { artigoId: id, automatico }
    try {
      const ref = db.collection('articles').doc(id)
      const snap = await ref.get()
      if (!snap.exists) {
        saida.resultados.push({ ...base, status: 'artigo-nao-encontrado' })
        continue
      }
      const sugRef = ref.collection('suggestions').doc(sid)
      if ((await sugRef.get()).exists) {
        saida.resultados.push({ ...base, status: 'ja-existia' })
        continue
      }
      const artigo = { id, ...snap.data() } as Article
      const r = await gerarSugestao(artigo, regras, provedor)
      if (r.tipo === 'nenhuma') {
        saida.resultados.push({
          ...base,
          status: 'nenhuma-mudanca',
          detalhe: r.motivo,
        })
        continue
      }
      if (!opcoes.gravar) {
        saida.resultados.push({
          ...base,
          status: 'simulada',
          detalhe: r.sugestao.diffResumo.join('; '),
        })
        continue
      }

      const { prints_desatualizados: prints, ...resto } = r.sugestao
      const batch = db.batch()
      batch.create(sugRef, {
        ...resto,
        pratsDesatualizados: prints,
        status: 'pending',
        automatico,
        origem: {
          tipo: 'regras-md',
          arquivo: regras.arquivo,
          hash: regras.hash,
          ...(opcoes.origem?.repo ? { repo: opcoes.origem.repo } : {}),
          ...(opcoes.origem?.commit ? { commit: opcoes.origem.commit } : {}),
        },
        // A sugestão vale para a versão que a IA leu; se o artigo mudar depois, o revisor vê.
        baseVersao: artigo.versao,
        baseAtualizadoEm: artigo.atualizadoEm,
        criadoEm: opcoes.agora,
      })
      if (prints) {
        batch.update(ref, {
          flags: FieldValue.arrayUnion('prints_desatualizados'),
        })
      }
      batch.set(db.collection('auditLog').doc(), {
        usuarioId: 'doc-sync',
        acao: 'sugestao.criar',
        alvo: `articles/${id}/suggestions/${sid}`,
        data: opcoes.agora,
      })
      await batch.commit()
      saida.resultados.push({ ...base, status: 'criada' })
    } catch (e) {
      saida.resultados.push({
        ...base,
        status: 'erro',
        detalhe: (e as Error).message,
      })
    }
  }
  return saida
}
