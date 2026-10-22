import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ViewsChart } from '../../components/ViewsChart'
import { useAsync } from '../../hooks/useAsync'
import { carregarMetricas } from '../../services/metrics'
import type { Article } from '../../types/content'
import {
  maisAcessados,
  semAcesso,
  semRevisao,
  serieDiaria,
  ultimosDias,
  viewsPorArtigo,
} from '../../utils/metrics'

const campo =
  'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900'

function Painel({
  titulo,
  vazio,
  children,
  total,
}: {
  titulo: string
  vazio: string
  total: number
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {total === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        children
      )}
    </section>
  )
}

function ListaArtigos({
  artigos,
  limite = 10,
}: {
  artigos: Article[]
  limite?: number
}) {
  return (
    <ul className="space-y-1 text-sm">
      {artigos.slice(0, limite).map((a) => (
        <li key={a.id} className="flex justify-between gap-3">
          <Link
            to={`/a/${a.id}`}
            className="truncate text-blue-700 hover:underline dark:text-blue-400"
          >
            {a.titulo}
          </Link>
          <span className="shrink-0 text-slate-500">
            {new Date(a.revisadoEm).toLocaleDateString('pt-BR')}
          </span>
        </li>
      ))}
      {artigos.length > limite && (
        <li className="text-slate-500">e mais {artigos.length - limite}…</li>
      )}
    </ul>
  )
}

export function MetricsPage() {
  const [dias, setDias] = useState(30)
  const [meses, setMeses] = useState(6)
  const { dados, erro, carregando, recarregar } = useAsync(
    () => carregarMetricas(dias),
    [dias],
  )

  const resumo = useMemo(() => {
    if (!dados) return null
    const agora = new Date()
    const noPeriodo = viewsPorArtigo(dados.views)
    return {
      serie: serieDiaria(ultimosDias(dias, agora), dados.views),
      ranking: maisAcessados(dados.artigos, noPeriodo),
      nuncaAcessados: semAcesso(dados.artigos),
      desatualizados: semRevisao(dados.artigos, meses, agora),
      publicados: dados.artigos.filter((a) => a.status === 'published').length,
      totalPeriodo: dados.views.reduce((s, v) => s + v.count, 0),
    }
  }, [dados, dias, meses])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Métricas</h1>
        <div className="flex items-center gap-2 text-sm">
          <label>
            Período{' '}
            <select
              className={campo}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
            </select>
          </label>
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-600"
          >
            Atualizar
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-slate-500">
        Cada carga lê um documento por artigo e um por artigo e dia com acesso
        no período. Atualize só quando precisar, para poupar a cota do Spark.
      </p>

      {carregando && !dados && <p className="text-slate-500">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {resumo && dados && (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ['Acessos no período', resumo.totalPeriodo],
              ['Artigos publicados', resumo.publicados],
              ['Nunca acessados', resumo.nuncaAcessados.length],
            ].map(([rotulo, valor]) => (
              <div
                key={rotulo}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <dt className="text-sm text-slate-500">{rotulo}</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>

          <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold">Evolução por período</h2>
            <ViewsChart pontos={resumo.serie} />
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <Painel
              titulo="Artigos mais acessados"
              total={resumo.ranking.length}
              vazio="Nenhum acesso registrado no período."
            >
              <ol className="space-y-1 text-sm">
                {resumo.ranking.map(({ artigo, noPeriodo }, i) => (
                  <li key={artigo.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className="mr-2 text-slate-500">{i + 1}.</span>
                      <Link
                        to={`/a/${artigo.id}`}
                        className="text-blue-700 hover:underline dark:text-blue-400"
                      >
                        {artigo.titulo}
                      </Link>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {noPeriodo}{' '}
                      <span className="text-slate-500">
                        ({artigo.views} no total)
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Painel>

            <Painel
              titulo="Artigos sem acesso"
              total={resumo.nuncaAcessados.length}
              vazio="Todos os artigos publicados já foram acessados."
            >
              <ListaArtigos artigos={resumo.nuncaAcessados} />
            </Painel>

            <Painel
              titulo="Buscas sem resultado"
              total={dados.buscasSemResultado.length}
              vazio="Nenhuma busca sem resultado registrada."
            >
              <ul className="space-y-1 text-sm">
                {dados.buscasSemResultado.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3">
                    <span className="truncate">{b.termo}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {b.count}×
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>

            <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Sem revisão há mais de</h2>
                <select
                  aria-label="Meses sem revisão"
                  className={campo}
                  value={meses}
                  onChange={(e) => setMeses(Number(e.target.value))}
                >
                  <option value={3}>3 meses</option>
                  <option value={6}>6 meses</option>
                  <option value={12}>12 meses</option>
                </select>
              </div>
              {resumo.desatualizados.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum artigo desatualizado.
                </p>
              ) : (
                <ListaArtigos artigos={resumo.desatualizados} />
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
