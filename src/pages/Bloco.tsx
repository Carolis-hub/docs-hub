import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBreadcrumb, listChildren } from '../services/blocks'
import { listArticlesByBlock } from '../services/articles'
import { Breadcrumb } from '../components/Breadcrumb'
import type { Block } from '../types/block'
import type { Article } from '../types/article'

export function Bloco() {
  const { blockId } = useParams<{ blockId: string }>()
  const [trilha, setTrilha] = useState<Block[]>([])
  const [subblocos, setSubblocos] = useState<Block[]>([])
  const [artigos, setArtigos] = useState<Article[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!blockId) return

    setCarregando(true)
    setErro(null)

    Promise.all([
      getBreadcrumb(blockId),
      listChildren(blockId),
      listArticlesByBlock(blockId, { apenasPublicados: true }),
    ])
      .then(([breadcrumb, filhos, artigosPublicados]) => {
        setTrilha(breadcrumb)
        setSubblocos(filhos)
        setArtigos(artigosPublicados)
      })
      .catch(() => setErro('Não foi possível carregar este bloco.'))
      .finally(() => setCarregando(false))
  }, [blockId])

  const blocoAtual = trilha.at(-1)

  return (
    <div>
      <Breadcrumb
        itens={trilha.map((bloco, indice) => ({
          label: bloco.nome,
          to: indice < trilha.length - 1 ? `/blocos/${bloco.id}` : undefined,
        }))}
      />

      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {!carregando && !erro && blocoAtual && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {blocoAtual.nome}
          </h1>
          {blocoAtual.descricao && (
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {blocoAtual.descricao}
            </p>
          )}

          {subblocos.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subblocos.map((subbloco) => (
                <Link
                  key={subbloco.id}
                  to={`/blocos/${subbloco.id}`}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                >
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                    {subbloco.nome}
                  </h2>
                  {subbloco.descricao && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {subbloco.descricao}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {artigos.length > 0 && (
            <ul className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {artigos.map((artigo) => (
                <li key={artigo.id}>
                  <Link
                    to={`/artigos/${artigo.id}`}
                    className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {artigo.titulo}
                    </span>
                    {artigo.resumo && (
                      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                        {artigo.resumo}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {subblocos.length === 0 && artigos.length === 0 && (
            <p className="mt-6 text-slate-500 dark:text-slate-400">
              Nenhum conteúdo publicado neste bloco ainda.
            </p>
          )}
        </>
      )}
    </div>
  )
}
