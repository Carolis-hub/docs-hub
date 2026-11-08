import { useEffect, useMemo, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ArticleContent } from '../components/ArticleContent'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { useSearchEngine } from '../hooks/useSearchEngine'
import { getArticle } from '../services/articles'
import { getAncestors, getBlock } from '../services/blocks'
import { registrarVisualizacao } from '../services/metrics'
import { getUnidade } from '../services/unidades'
import { nomeDaCategoria } from '../utils/categorias'
import { relacionados } from '../utils/relacionados'
import { extrairTopicos } from '../utils/topicos'
import { rotuloDoStatus } from '../utils/revisao'

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
  const conteudoRef = useRef<HTMLDivElement>(null)
  const atual = dados?.artigo
  const similares = useMemo(
    () => (motor && atual ? relacionados(motor, atual) : []),
    [motor, atual],
  )
  const topicos = useMemo(() => extrairTopicos(atual?.conteudo), [atual])

  function irParaTopico(texto: string) {
    const titulos =
      conteudoRef.current?.querySelectorAll<HTMLElement>('h1, h2, h3') ?? []
    for (const h of titulos) {
      if (h.textContent?.trim() === texto) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  }

  if (carregando) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo ">
        {erro}
      </p>
    )
  if (!dados) return <p>Artigo não encontrado.</p>

  const { artigo, cadeia, unidade } = dados
  const categoria = nomeDaCategoria(artigo.categoria)
  const meta = [
    `Atualizado em ${new Date(artigo.atualizadoEm).toLocaleDateString('pt-BR')}`,
    `${(artigo.views ?? 0).toLocaleString('pt-BR')} ${artigo.views === 1 ? 'visualização' : 'visualizações'}`,
    artigo.versaoProduto && `Versão do produto ${artigo.versaoProduto}`,
    artigo.publico === 'tecnico' && 'Técnico',
    isAdmin && artigo.status !== 'published' && rotuloDoStatus(artigo.status),
    isAdmin &&
      artigo.revisao &&
      `Alteração pendente: ${rotuloDoStatus(artigo.revisao.status)}`,
  ].filter(Boolean)

  return (
    <div>
      <Breadcrumb cadeia={cadeia} unidade={unidade} artigo={artigo} />
      <div className="flex flex-wrap items-start gap-8 lg:flex-nowrap">
        <article className="min-w-0 flex-1 basis-[560px]">
          <header className="mb-6 border-b border-borda pb-5">
            {categoria && (
              <span className="selo mb-3 border-transparent bg-bloco text-destaque">
                {categoria}
              </span>
            )}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">
                {artigo.titulo}
              </h1>
              {isAdmin && (
                <Link
                  to={`/admin/artigos/${artigo.id}/editar`}
                  className="botao"
                >
                  <Pencil className="size-4" aria-hidden />
                  Editar
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-suave">{meta.join(' · ')}</p>
          </header>
          <div ref={conteudoRef} className="cartao p-6 sm:p-8">
            <ArticleContent conteudo={artigo.conteudo} />
          </div>
        </article>

        <aside
          aria-label="Sobre este artigo"
          className="w-full shrink-0 space-y-8 lg:sticky lg:top-6 lg:w-[280px]"
        >
          {topicos.length > 0 && (
            <nav aria-label="Neste artigo">
              <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-suave">
                Neste artigo
              </h2>
              <ul className="space-y-1 border-l border-borda">
                {topicos.map((t, i) => (
                  <li key={`${t.texto}-${i}`}>
                    <button
                      type="button"
                      onClick={() => irParaTopico(t.texto)}
                      className={`block w-full py-1 pr-2 text-left text-sm text-suave hover:text-texto ${t.nivel >= 3 ? 'pl-7' : 'pl-4'}`}
                    >
                      {t.texto}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {similares.length > 0 && (
            <section aria-label="Artigos relacionados">
              <h2 className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-suave">
                Artigos relacionados
              </h2>
              <ul className="space-y-2">
                {similares.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/a/${s.id}`}
                      className="cartao block p-3 transition hover:border-destaque/50"
                    >
                      <span className="text-sm font-semibold">{s.titulo}</span>
                      {nomeDaCategoria(s.categoria) && (
                        <span className="mt-0.5 block text-xs text-suave">
                          {nomeDaCategoria(s.categoria)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {categoria && (
            <p className="text-sm text-suave">
              Mais artigos de{' '}
              <Link
                to={`/busca?categoria=${artigo.categoria}`}
                className="text-destaque hover:underline"
              >
                {categoria}
              </Link>
              .
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
