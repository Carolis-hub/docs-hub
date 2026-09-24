import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from '../services/blocks'
import type { Block } from '../types/block'

export function Home() {
  const [produtos, setProdutos] = useState<Block[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listProducts()
      .then(setProdutos)
      .catch(() => setErro('Não foi possível carregar os produtos.'))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Produtos
      </h1>

      {erro && (
        <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {!erro && produtos === null && (
        <p className="mt-4 text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {produtos !== null && produtos.length === 0 && (
        <p className="mt-4 text-slate-500 dark:text-slate-400">
          Nenhum produto cadastrado ainda.
        </p>
      )}

      {produtos !== null && produtos.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map((produto) => (
            <Link
              key={produto.id}
              to={`/blocos/${produto.id}`}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
            >
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {produto.nome}
              </h2>
              {produto.descricao && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {produto.descricao}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
