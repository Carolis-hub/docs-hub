import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArticleContent } from '../../components/ArticleContent'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { getArticle, publishArticle } from '../../services/articles'
import {
  discardSuggestion,
  getSuggestion,
  sugestaoDefasada,
} from '../../services/suggestions'

const botao = 'rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50'

export function SuggestionReview() {
  const { articleId = '', suggestionId = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando } = useAsync(async () => {
    const [artigo, sugestao] = await Promise.all([
      getArticle(articleId),
      getSuggestion(articleId, suggestionId),
    ])
    return artigo && sugestao ? { artigo, sugestao } : null
  }, [articleId, suggestionId])
  const [ocupado, setOcupado] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)

  if (carregando && !dados) return <p className="text-slate-500">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {erro}
      </p>
    )
  if (!dados) return <p>Sugestão não encontrada.</p>

  const { artigo, sugestao } = dados
  const pendente = sugestao.status === 'pending'
  const defasada = sugestaoDefasada(sugestao, artigo)

  async function executar(acao: () => Promise<void>) {
    setOcupado(true)
    setFalha(null)
    try {
      await acao()
      navigate('/admin/sugestoes')
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não foi possível concluir.')
      setOcupado(false)
    }
  }

  const aprovar = () =>
    executar(async () => {
      if (
        defasada &&
        !window.confirm(
          'O artigo mudou depois que a IA o leu. Aprovar vai sobrescrever essas mudanças. Continuar?',
        )
      ) {
        throw new Error('Aprovação cancelada.')
      }
      await publishArticle(
        artigo,
        {
          titulo: sugestao.titulo,
          conteudo: sugestao.conteudo,
          publico: artigo.publico,
          versaoProduto: artigo.versaoProduto,
        },
        uid,
        sugestao.id,
      )
    })

  const descartar = () =>
    executar(async () => {
      if (!window.confirm('Descartar esta sugestão?')) {
        throw new Error('Descarte cancelado.')
      }
      await discardSuggestion(articleId, sugestao.id, uid)
    })

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm">
        <Link to="/admin/sugestoes" className="text-slate-500 hover:underline">
          ← Sugestões
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{artigo.titulo}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Gerada de {sugestao.origem.arquivo} em{' '}
        {new Date(sugestao.criadoEm).toLocaleString('pt-BR')}
        {sugestao.origem.commit &&
          ` · commit ${sugestao.origem.commit.slice(0, 7)}`}
      </p>

      {!pendente && (
        <p
          role="status"
          className="mt-4 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800"
        >
          Esta sugestão já foi{' '}
          {sugestao.status === 'approved' ? 'aprovada' : 'descartada'}.
        </p>
      )}
      {defasada && pendente && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
        >
          O artigo foi alterado depois que a IA o leu. Compare com cuidado.
        </p>
      )}
      {sugestao.origem.tipo === 'alt-texto' && (
        <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800">
          Esta sugestão só troca textos alternativos de imagens. O que você vê
          nas duas colunas é igual; confira as descrições na lista abaixo.
        </p>
      )}
      {sugestao.automatico && (
        <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-800">
          Este artigo foi escolhido por busca, não indicado nas regras. Descarte
          se não for o artigo certo.
        </p>
      )}
      {sugestao.pratsDesatualizados && (
        <p className="mt-4 rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          As regras mudam telas ou campos: os prints deste artigo podem estar
          desatualizados.
        </p>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-2 font-semibold">O que mudou</h2>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          {sugestao.motivo}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {sugestao.diffResumo.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        {sugestao.avisos.length > 0 && (
          <div className="mt-3 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Atenção ao revisar:</p>
            <ul className="list-disc pl-5">
              {sugestao.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-label="Versão atual">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Versão atual
          </h2>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <ArticleContent conteudo={artigo.conteudo} />
          </div>
        </section>
        <section aria-label="Sugestão da IA">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sugestão
          </h2>
          <div className="rounded-lg border border-blue-300 bg-white p-4 dark:border-blue-700 dark:bg-slate-800">
            {sugestao.titulo !== artigo.titulo && (
              <p className="mb-3 text-sm">
                Novo título: <strong>{sugestao.titulo}</strong>
              </p>
            )}
            <ArticleContent conteudo={sugestao.conteudo} />
          </div>
        </section>
      </div>

      {falha && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {falha}
        </p>
      )}
      {pendente && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void aprovar()}
            className={`${botao} bg-green-600 text-white hover:bg-green-700`}
          >
            Aprovar e publicar
          </button>
          <Link
            to={`/admin/artigos/${artigo.id}/editar?sugestao=${sugestao.id}`}
            className={`${botao} border border-slate-300 dark:border-slate-600`}
          >
            Editar antes de aprovar
          </Link>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void descartar()}
            className={`${botao} border border-red-300 text-red-700 dark:border-red-800 dark:text-red-400`}
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}
