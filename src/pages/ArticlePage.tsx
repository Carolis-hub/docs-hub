import { useEffect, useMemo } from 'react'
import { Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ArticleContent } from '../components/ArticleContent'
import { Breadcrumb } from '../components/Breadcrumb'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { getArticle } from '../services/articles'
import { getAncestors, getBlock } from '../services/blocks'
import { registrarVisualizacao } from '../services/metrics'
import { getUnidade } from '../services/unidades'
import { nomeDaCategoria } from '../utils/categorias'
import { relacionados } from '../utils/relacionados'
import { rotuloDoStatus } from '../utils/revisao'
import { iconeDoArtigo } from '../utils/iconeDoArtigo'

export function ArticlePage() {
  const { articleId = '' } = useParams()
  const { user, isAdmin } = useAuth()
  const { dados, erro, carregando } = useAsync(async () => {
    const artigo = await getArticle(articleId)
    if (!artigo) return null
    const bloco = await getBlock(artigo.blockId)
    const cadeia = bloco ? await getAncestors(bloco) : []
    const unidadeId = cadeia[0]?.unidadeId
    const unidade = unidadeId ? await getUnidade(unidadeId) : null
    return { artigo, cadeia, unidade }
  }, [articleId])

  const artigoId = dados?.artigo.id
  const publicado = dados?.artigo.status === 'published'
  const uid = user?.uid
  useEffect(() => {
    // Admins não entram na contagem; rascunhos nem são visíveis a leitores.
    if (!artigoId || !uid || isAdmin || !publicado) return
    void registrarVisualizacao(artigoId, uid)
  }, [artigoId, uid, isAdmin, publicado])

  const motor = useSearchEngine().dados?.motor
  const atual = dados?.artigo
  const similares = useMemo(
    () => (motor && atual ? relacionados(motor, atual) : []),
    [motor, atual],
  )
  if (carregando) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo ">
        {erro}
      </p>
    )
  if (!dados) return <p>Artigo não encontrado.</p>

  const { artigo, cadeia, unidade } = dados
  const meta = [
    `Atualizado em ${new Date(artigo.atualizadoEm).toLocaleDateString('pt-BR')}`,
    nomeDaCategoria(artigo.categoria),
    artigo.versaoProduto && `Versão do produto ${artigo.versaoProduto}`,
    artigo.publico === 'tecnico' && 'Técnico',
    isAdmin && artigo.status !== 'published' && rotuloDoStatus(artigo.status),
    isAdmin &&
      artigo.revisao &&
      `Alteração pendente: ${rotuloDoStatus(artigo.revisao.status)}`,
  ].filter(Boolean)

  return (
    <article className="mx-auto max-w-4xl">
      <Breadcrumb cadeia={cadeia} unidade={unidade} artigo={artigo} />
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
      {(similares.length > 0 || nomeDaCategoria(artigo.categoria)) && (
        <aside aria-label="Documentações relacionadas" className="mt-8">
          {similares.length > 0 && (
            <>
              <h2 className="mb-3 text-lg font-semibold">
                Documentações relacionadas
              </h2>
              <ul className="space-y-2">
                {similares.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/a/${s.id}`}
                      className="cartao block p-3 transition hover:border-destaque/50"
                    >
                      <span className="font-medium">{s.titulo}</span>
                      {nomeDaCategoria(s.categoria) && (
                        <span className="selo ml-2">
                          {nomeDaCategoria(s.categoria)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {nomeDaCategoria(artigo.categoria) && (
            <p className="mt-4 text-sm text-suave">
              Mais artigos de{' '}
              <Link
                to={`/busca?categoria=${artigo.categoria}`}
                className="text-bloco-icone hover:underline"
              >
                {nomeDaCategoria(artigo.categoria)}
              </Link>
              .
            </p>
          )}
        </aside>
      )}
    </article>
  )
}
