import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArticleContent } from '../components/ArticleContent'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { getArticle } from '../services/articles'
import { getAncestors, getBlock } from '../services/blocks'
import { registrarVisualizacao } from '../services/metrics'

export function ArticlePage() {
  const { articleId = '' } = useParams()
  const { user, isAdmin } = useAuth()
  const { dados, erro, carregando } = useAsync(async () => {
    const artigo = await getArticle(articleId)
    if (!artigo) return null
    const bloco = await getBlock(artigo.blockId)
    const cadeia = bloco ? await getAncestors(bloco) : []
    return { artigo, cadeia }
  }, [articleId])

  const artigoId = dados?.artigo.id
  const publicado = dados?.artigo.status === 'published'
  const uid = user?.uid
  useEffect(() => {
    // Admins não entram na contagem; rascunhos nem são visíveis a leitores.
    if (!artigoId || !uid || isAdmin || !publicado) return
    void registrarVisualizacao(artigoId, uid)
  }, [artigoId, uid, isAdmin, publicado])

  if (carregando) return <p className="text-slate-500">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {erro}
      </p>
    )
  if (!dados) return <p>Artigo não encontrado.</p>

  const { artigo, cadeia } = dados
  return (
    <article className="mx-auto max-w-3xl">
      <Breadcrumb cadeia={cadeia} artigo={artigo} />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{artigo.titulo}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Atualizado em{' '}
            {new Date(artigo.atualizadoEm).toLocaleDateString('pt-BR')}
            {artigo.versaoProduto &&
              ` · Versão do produto ${artigo.versaoProduto}`}
            {artigo.publico === 'tecnico' && ' · Técnico'}
            {isAdmin && artigo.status === 'draft' && ' · Rascunho'}
          </p>
        </div>
        {isAdmin && (
          <Link
            to={`/admin/artigos/${artigo.id}/editar`}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
          >
            Editar
          </Link>
        )}
      </div>
      <ArticleContent conteudo={artigo.conteudo} />
    </article>
  )
}
