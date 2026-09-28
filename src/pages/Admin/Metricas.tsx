import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listArtigosMaisAcessados,
  listArtigosSemAcesso,
  listArtigosSemRevisao,
  listBuscasSemResultado,
  listViewsPorDia,
  type BuscaSemResultado,
  type ViewsPorDia,
} from '../../services/metrics'
import type { Article } from '../../types/article'

const MESES_SEM_REVISAO = 6

function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function ListaDeArtigos({
  artigos,
  vazio,
  mostrarViews,
}: {
  artigos: Article[]
  vazio: string
  mostrarViews?: boolean
}) {
  if (artigos.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{vazio}</p>
  }

  return (
    <ul className="space-y-1">
      {artigos.map((artigo) => (
        <li key={artigo.id} className="flex justify-between text-sm">
          <Link
            to={`/artigos/${artigo.id}`}
            className="text-slate-700 hover:underline dark:text-slate-300"
          >
            {artigo.titulo}
          </Link>
          {mostrarViews && (
            <span className="text-slate-500 dark:text-slate-400">
              {artigo.views} acessos
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function AdminMetricas() {
  const [maisAcessados, setMaisAcessados] = useState<Article[] | null>(null)
  const [semAcesso, setSemAcesso] = useState<Article[] | null>(null)
  const [semRevisao, setSemRevisao] = useState<Article[] | null>(null)
  const [buscasSemResultado, setBuscasSemResultado] = useState<
    BuscaSemResultado[] | null
  >(null)
  const [viewsPorDia, setViewsPorDia] = useState<ViewsPorDia[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      listArtigosMaisAcessados(10),
      listArtigosSemAcesso(),
      listArtigosSemRevisao(MESES_SEM_REVISAO),
      listBuscasSemResultado(10),
      listViewsPorDia(14),
    ])
      .then(([acessados, semAcessoLista, semRevisaoLista, buscas, views]) => {
        setMaisAcessados(acessados)
        setSemAcesso(semAcessoLista)
        setSemRevisao(semRevisaoLista)
        setBuscasSemResultado(buscas)
        setViewsPorDia(views)
      })
      .catch(() => setErro('Não foi possível carregar as métricas.'))
  }, [])

  const carregando = maisAcessados === null

  const maiorTotal = Math.max(1, ...(viewsPorDia ?? []).map((d) => d.total))

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Métricas
      </h1>

      {erro && (
        <p role="alert" className="mb-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && !erro && (
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {!carregando && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Secao titulo="Artigos mais acessados">
            <ListaDeArtigos
              artigos={maisAcessados ?? []}
              vazio="Nenhum acesso registrado ainda."
              mostrarViews
            />
          </Secao>

          <Secao titulo="Artigos sem acesso">
            <ListaDeArtigos
              artigos={semAcesso ?? []}
              vazio="Todos os artigos publicados já foram acessados."
            />
          </Secao>

          <Secao titulo={`Sem revisão há mais de ${MESES_SEM_REVISAO} meses`}>
            <ListaDeArtigos
              artigos={semRevisao ?? []}
              vazio="Nenhum artigo atrasado na revisão."
            />
          </Secao>

          <Secao titulo="Buscas sem resultado">
            {buscasSemResultado && buscasSemResultado.length > 0 ? (
              <ul className="space-y-1">
                {buscasSemResultado.map((busca) => (
                  <li
                    key={busca.termo}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      “{busca.termo}”
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {busca.contagem}×
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma busca sem resultado registrada.
              </p>
            )}
          </Secao>

          <Secao titulo="Acessos por dia (últimos 14 dias)">
            {viewsPorDia && viewsPorDia.length > 0 ? (
              <div className="flex h-32 gap-1">
                {viewsPorDia.map((dia) => (
                  <div
                    key={dia.dia}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${dia.dia}: ${dia.total} acessos`}
                  >
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t bg-slate-700 dark:bg-slate-300"
                        style={{ height: `${(dia.total / maiorTotal) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {dia.dia.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum acesso registrado ainda.
              </p>
            )}
          </Secao>
        </div>
      )}
    </div>
  )
}
