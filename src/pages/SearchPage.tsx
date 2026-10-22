import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Highlight } from '../components/Highlight'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { registrarBuscaSemResultado } from '../services/search'
import type { ArticlePublico } from '../types/content'
import { gerarTrecho } from '../utils/search'

const campo =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const produto = params.get('produto') ?? ''
  const publico = (params.get('publico') ?? '') as ArticlePublico | ''
  const { dados, erro, carregando } = useSearchEngine()

  const resultados = useMemo(
    () =>
      dados?.motor.buscar(q, {
        productId: produto || undefined,
        publico: publico || undefined,
      }) ?? [],
    [dados, q, produto, publico],
  )

  const semResultado = !!dados && !!q.trim() && resultados.length === 0
  useEffect(() => {
    // Só a busca sem filtros conta como "sem resultado" de verdade.
    if (semResultado && !produto && !publico) {
      void registrarBuscaSemResultado(q)
    }
  }, [semResultado, q, produto, publico])

  function atualizar(chave: string, valor: string) {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  const nomeProduto = new Map(
    (dados?.produtos ?? []).map((p) => [p.id, p.nome]),
  )

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">Busca</h1>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 flex flex-wrap gap-2"
      >
        <input
          type="search"
          aria-label="Termo de busca"
          value={q}
          onChange={(e) => atualizar('q', e.target.value)}
          placeholder="Buscar por título ou conteúdo"
          className={`${campo} min-w-0 flex-1`}
        />
        <select
          aria-label="Filtrar por produto"
          value={produto}
          onChange={(e) => atualizar('produto', e.target.value)}
          className={campo}
        >
          <option value="">Todos os produtos</option>
          {(dados?.produtos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por público"
          value={publico}
          onChange={(e) => atualizar('publico', e.target.value)}
          className={campo}
        >
          <option value="">Todos os públicos</option>
          <option value="usuario">Usuário</option>
          <option value="tecnico">Técnico</option>
        </select>
      </form>

      {carregando && !dados && (
        <p className="text-slate-500">Carregando índice…</p>
      )}
      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      {dados && !q.trim() && (
        <p className="text-slate-600 dark:text-slate-400">
          Digite para buscar em {dados.motor.total} artigos.
        </p>
      )}
      {semResultado && (
        <p className="text-slate-600 dark:text-slate-400">
          Nenhum resultado para “{q}”.
        </p>
      )}

      {resultados.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-500" aria-live="polite">
            {resultados.length} resultado{resultados.length > 1 ? 's' : ''}
          </p>
          <ul className="space-y-3">
            {resultados.map(({ item, termos }) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <Link
                  to={`/a/${item.id}`}
                  className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Highlight partes={gerarTrecho(item.titulo, termos, 120)} />
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {nomeProduto.get(item.productId) ?? item.productId}
                  {item.publico === 'tecnico' && ' · Técnico'}
                </p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  <Highlight
                    partes={gerarTrecho(item.textoPlano || item.resumo, termos)}
                  />
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
