import type { Article, ArticleDraft, Block } from '../types/content'

/** "Produto › Seção › Subseção" do bloco, para situar o artigo na fila. */
export function caminhoDoBloco(blocos: Block[], blockId: string): string {
  const porId = new Map(blocos.map((b) => [b.id, b]))
  const nomes: string[] = []
  const vistos = new Set<string>()
  let atual = porId.get(blockId)
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id)
    nomes.unshift(atual.nome)
    atual = atual.parentId ? porId.get(atual.parentId) : undefined
  }
  return nomes.join(' › ')
}

/** O artigo como está gravado, no formato que o publicar espera. */
export function rascunhoDoArtigo(a: Article): ArticleDraft {
  return {
    titulo: a.titulo,
    conteudo: a.conteudo,
    publico: a.publico,
    categoria: a.categoria ?? '',
    versaoProduto: a.versaoProduto,
  }
}

/** Rótulo do status para o admin. */
export function rotuloDoStatus(status: Article['status']): string {
  return status === 'published'
    ? 'Publicado'
    : status === 'review'
      ? 'Em revisão'
      : 'Rascunho'
}
