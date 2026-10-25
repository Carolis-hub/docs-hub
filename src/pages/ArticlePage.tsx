import { useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ArticleContent } from '../components/ArticleContent'
import { Breadcrumb } from '../components/Breadcrumb'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { getArticle } from '../services/articles'
import { getAncestors, getBlock } from '../services/blocks'
import { registrarVisualizacao } from '../services/metrics'
import { iconeDoArtigo } from '../utils/iconeDoArtigo'

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

  if (carregando) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo ">
        {erro}
      </p>
    )
  if (!dados) return <p>Artigo não encontrado.</p>

  const { artigo, cadeia } = dados
  const meta = [
    `Atualizado em ${new Date(artigo.atualizadoEm).toLocaleDateString('pt-BR')}`,
    artigo.versaoProduto && `Versão do produto ${artigo.versaoProduto}`,
    artigo.publico === 'tecnico' && 'Técnico',
    isAdmin && artigo.status === 'draft' && 'Rascunho',
  ].filter(Boolean)

  return (
    <article className="mx-auto max-w-4xl">
      <Breadcrumb cadeia={cadeia} artigo={artigo} />
      <PageHeader
        icone={iconeDoArtigo(artigo.titulo)}
        titulo={artigo.titulo}
        subtitulo={meta.join(' · ')}
        acoes={
          isAdmin && (
            <Link to={`/admin/artigos/${artigo.id}/editar`} className="botao">
              <Pencil className="size-4" aria-hidden />
              Editar
            </Link>
          )
        }
      />
      <div className="cartao p-6 sm:p-8">
        <ArticleContent conteudo={artigo.conteudo} />
      </div>
    </article>
  )
}
