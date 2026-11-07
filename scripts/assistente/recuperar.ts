import type { Firestore } from 'firebase-admin/firestore'
import type { Article, Block, CategoriaId } from '../../src/types/content.ts'
import type { FiltrosAssistente } from '../../src/types/assistente.ts'
import type { IndexedItem, SearchItem } from '../../src/types/search.ts'
import { comDescendentes } from '../../src/utils/blocos.ts'
import { criarMotor } from '../../src/utils/searchEngine.ts'
import { docParaMarkdown } from '../../src/utils/tiptapMarkdown.ts'

/** O que o usuário pode ler: o mesmo que as regras do Firestore permitem na tela. */
export interface Escopo {
  admin: boolean
  verTecnico: boolean
  produtos: string[]
}

/** `null` quando a conta não tem perfil ou está desativada. */
export async function escopoDoUsuario(
  db: Firestore,
  uid: string,
): Promise<Escopo | null> {
  const snap = await db.collection('users').doc(uid).get()
  if (!snap.exists || snap.get('ativo') === false) return null
  const admin = snap.get('role') === 'admin'
  if (admin) {
    const raizes = await db
      .collection('blocks')
      .where('parentId', '==', null)
      .get()
    return { admin, verTecnico: true, produtos: raizes.docs.map((d) => d.id) }
  }
  return {
    admin,
    verTecnico: snap.get('verTecnico') === true,
    produtos: (snap.get('produtosPermitidos') as string[] | undefined) ?? [],
  }
}

export interface EscopoFiltrado {
  produtos: string[]
  /** Quando há subproduto escolhido: ele e tudo o que há dentro. */
  blocos?: ReadonlySet<string>
}

/** Aplica os filtros da pergunta sem nunca ampliar o escopo do usuário. */
export async function aplicarFiltros(
  db: Firestore,
  escopo: Escopo,
  filtros: FiltrosAssistente,
): Promise<EscopoFiltrado> {
  let produtos = escopo.produtos
  if (filtros.unidadeId) {
    const raizes = await db
      .collection('blocks')
      .where('unidadeId', '==', filtros.unidadeId)
      .get()
    const daUnidade = new Set(raizes.docs.map((d) => d.id))
    produtos = produtos.filter((p) => daUnidade.has(p))
  }
  if (filtros.produtoId) {
    produtos = produtos.filter((p) => p === filtros.produtoId)
  }
  if (filtros.subprodutoId && produtos.length > 0) {
    const arvore: Block[] = []
    for (const produto of produtos) {
      const snap = await db
        .collection('blocks')
        .where('productId', '==', produto)
        .get()
      arvore.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Block))
    }
    const alvo = arvore.find((b) => b.id === filtros.subprodutoId)
    if (!alvo) return { produtos: [] }
    return {
      produtos: [alvo.productId],
      blocos: comDescendentes(arvore, filtros.subprodutoId),
    }
  }
  return { produtos }
}

/** Lê o índice de busca (só artigos publicados) dos produtos. */
export async function lerIndice(
  db: Firestore,
  produtos: string[],
): Promise<IndexedItem[]> {
  const itens: IndexedItem[] = []
  for (const productId of produtos) {
    const ref = db.collection('searchIndex').doc(productId)
    const principal = await ref.get()
    if (!principal.exists) continue
    const dados = principal.data() as {
      itens?: SearchItem[]
      dividido?: boolean
    }
    let lista = dados.itens ?? []
    if (dados.dividido) {
      const partes = await ref.collection('partes').get()
      lista = partes.docs.flatMap((p) => (p.data().itens as SearchItem[]) ?? [])
    }
    itens.push(...lista.map((i) => ({ ...i, productId })))
  }
  return itens
}

/**
 * Candidatos para a pergunta: roda cada consulta no motor de busca e junta os
 * resultados pela posição em cada lista (reciprocal rank fusion), de modo que
 * um artigo que aparece bem em várias consultas sobe.
 */
export function selecionarCandidatos(
  itens: IndexedItem[],
  consultas: string[],
  opcoes: {
    verTecnico: boolean
    categoria?: CategoriaId
    blocos?: ReadonlySet<string>
    limite: number
  },
): IndexedItem[] {
  const motor = criarMotor(itens, opcoes.verTecnico)
  const pontos = new Map<string, { item: IndexedItem; pontos: number }>()
  for (const consulta of consultas) {
    const hits = motor.buscar(consulta, {
      combinar: 'OR',
      categoria: opcoes.categoria,
      blockIds: opcoes.blocos,
    })
    hits.forEach((h, posicao) => {
      const atual = pontos.get(h.item.id) ?? { item: h.item, pontos: 0 }
      atual.pontos += 1 / (60 + posicao)
      pontos.set(h.item.id, atual)
    })
  }
  return [...pontos.values()]
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, opcoes.limite)
    .map((p) => p.item)
}

export interface FonteCarregada {
  id: string
  titulo: string
  produtoId: string
  produto: string
  markdown: string
}

/**
 * Carrega o texto dos artigos escolhidos, conferindo de novo o acesso: só
 * artigo PUBLICADO, de produto permitido e, se técnico, para quem pode vê-lo.
 * (O Admin SDK ignora as regras do Firestore, então a checagem é feita aqui.)
 */
export async function carregarFontes(
  db: Firestore,
  ids: string[],
  escopo: Escopo,
  maxCaracteres: number,
): Promise<FonteCarregada[]> {
  if (ids.length === 0) return []
  const snaps = await db.getAll(
    ...ids.map((id) => db.collection('articles').doc(id)),
  )
  const permitidos = new Set(escopo.produtos)
  const artigos = snaps
    .filter((s) => s.exists)
    .map((s) => ({ id: s.id, ...s.data() }) as Article)
    .filter(
      (a) =>
        a.status === 'published' &&
        permitidos.has(a.productId) &&
        (a.publico === 'usuario' || escopo.verTecnico),
    )
  const produtosIds = [...new Set(artigos.map((a) => a.productId))]
  const nomes = new Map<string, string>()
  if (produtosIds.length > 0) {
    const produtos = await db.getAll(
      ...produtosIds.map((p) => db.collection('blocks').doc(p)),
    )
    produtos.forEach((p) => nomes.set(p.id, String(p.get('nome') ?? p.id)))
  }
  // Mantém a ordem pedida (do mais ao menos relevante).
  const porId = new Map(artigos.map((a) => [a.id, a]))
  return ids
    .map((id) => porId.get(id))
    .filter((a): a is Article => !!a)
    .map((a) => {
      const md = docParaMarkdown(a.conteudo)
      return {
        id: a.id,
        titulo: a.titulo,
        produtoId: a.productId,
        produto: nomes.get(a.productId) ?? a.productId,
        markdown:
          md.length > maxCaracteres
            ? `${md.slice(0, maxCaracteres)}\n\n[… texto cortado por tamanho]`
            : md,
      }
    })
}
