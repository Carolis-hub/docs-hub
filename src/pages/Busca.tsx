import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBusca } from '../hooks/useBusca'
import { useUserProfile } from '../hooks/useUserProfile'
import { listProducts } from '../services/blocks'
import { gerarTrecho } from '../utils/trecho'
import type { Block } from '../types/block'
import type { ArticlePublico } from '../types/article'

export function Busca() {
  const [searchParams, setSearchParams] = useSearchParams()
  const termoInicial = searchParams.get('q') ?? ''
  const { profile } = useUserProfile()
  const { termo, resultados, pesquisar, carregando, erro } = useBusca()

  const [produtos, setProdutos] = useState<Block[]>([])
  const [filtroProduto, setFiltroProduto] = useState('')
  const [filtroPublico, setFiltroPublico] = useState<ArticlePublico | ''>('')

  useEffect(() => {
    if (termoInicial) void pesquisar(termoInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termoInicial])

  useEffect(() => {
    if (!profile) return
    const filtro =
      profile.role === 'admin' ? undefined : profile.produtosPermitidos
    listProducts(filtro)
      .then(setProdutos)
      .catch(() => undefined)
  }, [profile])

  const resultadosFiltrados = useMemo(() => {
    return resultados.filter((resultado) => {
      if (filtroProduto && resultado.productId !== filtroProduto) return false
      if (filtroPublico && resultado.publico !== filtroPublico) return false
      return true
    })
  }, [resultados, filtroProduto, filtroPublico])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams(termo ? { q: termo } : {})
    void pesquisar(termo)
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Busca
      </h1>

      <form onSubmit={handleSubmit} className="mb-4">
        <input
          type="search"
          value={termo}
          onChange={(event) => void pesquisar(event.target.value)}
          placeholder="O que você está procurando?"
          className="w-full max-w-xl rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </form>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={filtroProduto}
          onChange={(event) => setFiltroProduto(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Todos os produtos</option>
          {produtos.map((produto) => (
            <option key={produto.id} value={produto.id}>
              {produto.nome}
            </option>
          ))}
        </select>

        <select
          value={filtroPublico}
          onChange={(event) =>
            setFiltroPublico(event.target.value as ArticlePublico | '')
          }
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Usuário e técnico</option>
          <option value="usuario">Só usuário</option>
          <option value="tecnico">Só técnico</option>
        </select>
      </div>

      {erro && (
        <p role="alert" className="mb-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="text-slate-500 dark:text-slate-400">Buscando…</p>
      )}

      {!carregando &&
        termo.trim().length >= 2 &&
        resultadosFiltrados.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">
            Nenhum resultado para “{termo}”.
          </p>
        )}

      <ul className="space-y-4">
        {resultadosFiltrados.map((resultado) => {
          const trecho = gerarTrecho(resultado.textoPlano, [termo])
          return (
            <li
              key={resultado.id}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
            >
              <Link
                to={`/artigos/${resultado.id}`}
                className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
              >
                {resultado.titulo}
              </Link>
              {resultado.publico === 'tecnico' && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Técnico
                </span>
              )}
              {trecho && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {trecho.antes}
                  <mark className="bg-amber-200 dark:bg-amber-700">
                    {trecho.destaque}
                  </mark>
                  {trecho.depois}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
