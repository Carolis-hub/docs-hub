import { Link } from 'react-router-dom'
import { useAsync } from '../../hooks/useAsync'
import { getArticle } from '../../services/articles'
import { listPendingSuggestions } from '../../services/suggestions'

export function SuggestionsPage() {
  const { dados, erro, carregando } = useAsync(async () => {
    const sugestoes = await listPendingSuggestions()
    const titulos = new Map<string, string>()
    await Promise.all(
      [...new Set(sugestoes.map((s) => s.articleId))].map(async (id) => {
        titulos.set(id, (await getArticle(id))?.titulo ?? id)
      }),
    )
    return { sugestoes, titulos }
  }, [])

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-semibold">Sugestões da IA</h1>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Atualizações propostas a partir dos arquivos de regras. Nada vai ao ar
        sem a sua aprovação.
      </p>

      {carregando && !dados && <p className="text-slate-500">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      {dados && dados.sugestoes.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">
          Nenhuma sugestão pendente.
        </p>
      )}
      {dados && dados.sugestoes.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {dados.sugestoes.map((s) => (
            <li key={`${s.articleId}/${s.id}`}>
              <Link
                to={`/admin/sugestoes/${s.articleId}/${s.id}`}
                className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <span className="font-medium">
                  {dados.titulos.get(s.articleId)}
                </span>
                {s.pratsDesatualizados && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Prints desatualizados
                  </span>
                )}
                {s.automatico && (
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                    Artigo sugerido pela busca
                  </span>
                )}
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {s.diffResumo.slice(0, 2).join(' · ') || s.motivo}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.origem.arquivo} ·{' '}
                  {new Date(s.criadoEm).toLocaleString('pt-BR')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
