import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getArticle } from '../services/articles'
import { getBreadcrumb } from '../services/blocks'
import { registrarVisualizacao } from '../services/metrics'
import { Breadcrumb } from '../components/Breadcrumb'
import { ArticleViewer } from '../components/editor/ArticleEditor'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import type { Article } from '../types/article'
import type { Block } from '../types/block'

export function Artigo() {
  const { articleId } = useParams<{ articleId: string }>()
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [artigo, setArtigo] = useState<Article | null>(null)
  const [trilha, setTrilha] = useState<Block[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!articleId) return

    setCarregando(true)
    setErro(null)

    getArticle(articleId)
      .then(async (encontrado) => {
        if (!encontrado || encontrado.status !== 'published') {
          setErro('Artigo não encontrado.')
          return
        }
        setArtigo(encontrado)
        setTrilha(await getBreadcrumb(encontrado.blockId))
      })
      .catch(() => setErro('Não foi possível carregar o artigo.'))
      .finally(() => setCarregando(false))
  }, [articleId])

  useEffect(() => {
    if (!articleId || !user || !profile) return
    void registrarVisualizacao(articleId, user.uid, profile.role)
  }, [articleId, user, profile])

  if (carregando) {
    return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
  }

  if (erro || !artigo) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {erro ?? 'Artigo não encontrado.'}
      </p>
    )
  }

  return (
    <article>
      <Breadcrumb
        itens={[
          ...trilha.map((bloco) => ({
            label: bloco.nome,
            to: `/blocos/${bloco.id}`,
          })),
          { label: artigo.titulo },
        ]}
      />

      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {artigo.titulo}
        </h1>
        {artigo.publico === 'tecnico' && (
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            Conteúdo técnico
          </span>
        )}
      </header>

      <ArticleViewer conteudo={artigo.conteudo} />
    </article>
  )
}
