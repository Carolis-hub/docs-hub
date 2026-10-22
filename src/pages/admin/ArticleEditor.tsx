import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { JSONContent } from '@tiptap/react'
import { RichEditor } from '../../components/editor/RichEditor'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import {
  createArticle,
  deleteArticle,
  getArticle,
  listVersions,
  publishArticle,
  saveArticle,
  unpublishArticle,
} from '../../services/articles'
import { getBlock } from '../../services/blocks'
import type {
  Article,
  ArticleDraft,
  ArticlePublico,
  ArticleVersion,
} from '../../types/content'
import { EMPTY_DOC } from '../../utils/content'

const campo =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900'
const botaoSec =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600'

export function ArticleEditor() {
  const { articleId } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid ?? ''

  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    if (articleId) {
      const artigo = await getArticle(articleId)
      const versoes = artigo ? await listVersions(artigo.id) : []
      return { artigo, versoes }
    }
    return { artigo: null as Article | null, versoes: [] as ArticleVersion[] }
  }, [articleId])

  const [titulo, setTitulo] = useState('')
  const [publico, setPublico] = useState<ArticlePublico>('usuario')
  const [versaoProduto, setVersaoProduto] = useState('')
  const [conteudo, setConteudo] = useState<JSONContent>(EMPTY_DOC)
  const [editorKey, setEditorKey] = useState(0)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const artigo = dados?.artigo ?? null

  useEffect(() => {
    if (!artigo) return
    setTitulo(artigo.titulo)
    setPublico(artigo.publico)
    setVersaoProduto(artigo.versaoProduto ?? '')
    setConteudo(artigo.conteudo)
    setEditorKey((k) => k + 1)
  }, [artigo])

  if (carregando && !dados) return <p className="text-slate-500">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {erro}
      </p>
    )
  if (articleId && !artigo) return <p>Artigo não encontrado.</p>

  const draft = (): ArticleDraft => ({
    titulo,
    conteudo,
    publico,
    versaoProduto,
  })

  async function executar(acao: () => Promise<string | void>) {
    setOcupado(true)
    setFalha(null)
    setMensagem(null)
    try {
      const resultado = await acao()
      if (resultado) setMensagem(resultado)
    } catch (e) {
      setFalha(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setOcupado(false)
    }
  }

  const salvar = () =>
    executar(async () => {
      if (artigo) {
        await saveArticle(artigo.id, draft(), uid)
        recarregar()
        return 'Alterações salvas.'
      }
      const blockId = params.get('blockId')
      const bloco = blockId ? await getBlock(blockId) : null
      if (!bloco) throw new Error('Bloco de destino não encontrado.')
      const id = await createArticle(draft(), bloco.id, bloco.productId, uid)
      navigate(`/admin/artigos/${id}/editar`, { replace: true })
    })

  const publicar = () =>
    executar(async () => {
      if (!artigo) throw new Error('Salve o rascunho antes de publicar.')
      const versao = await publishArticle(artigo, draft(), uid)
      recarregar()
      return `Publicado (versão ${versao}).`
    })

  const despublicar = () =>
    executar(async () => {
      if (!artigo) return
      await unpublishArticle(artigo.id, uid)
      recarregar()
      return 'Artigo voltou para rascunho.'
    })

  const excluir = () =>
    executar(async () => {
      if (!artigo || !window.confirm('Excluir este artigo e suas versões?'))
        return
      await deleteArticle(artigo.id)
      navigate(`/b/${artigo.blockId}`, { replace: true })
    })

  function restaurar(v: ArticleVersion) {
    if (!window.confirm(`Carregar a versão ${v.versao} no editor?`)) return
    setTitulo(v.titulo)
    setConteudo(v.conteudo)
    setEditorKey((k) => k + 1)
    setMensagem(
      `Versão ${v.versao} carregada. Salve ou publique para confirmar a restauração.`,
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-semibold">
        {artigo ? 'Editar artigo' : 'Novo artigo'}
        {artigo && (
          <span className="ml-3 rounded bg-slate-200 px-2 py-0.5 text-xs font-normal dark:bg-slate-700">
            {artigo.status === 'published'
              ? `Publicado v${artigo.versao}`
              : 'Rascunho'}
          </span>
        )}
      </h1>

      <div className="space-y-4">
        <label className="block text-sm">
          Título
          <input
            className={campo}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Público
            <select
              className={campo}
              value={publico}
              onChange={(e) => setPublico(e.target.value as ArticlePublico)}
            >
              <option value="usuario">Usuário</option>
              <option value="tecnico">Técnico</option>
            </select>
          </label>
          <label className="block text-sm">
            Versão do produto (opcional)
            <input
              className={campo}
              value={versaoProduto}
              onChange={(e) => setVersaoProduto(e.target.value)}
            />
          </label>
        </div>

        <RichEditor key={editorKey} value={conteudo} onChange={setConteudo} />

        {falha && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {falha}
          </p>
        )}
        {mensagem && (
          <p
            role="status"
            className="text-sm text-green-700 dark:text-green-400"
          >
            {mensagem}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void salvar()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {artigo ? 'Salvar' : 'Criar rascunho'}
          </button>
          {artigo && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void publicar()}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Publicar
              </button>
              {artigo.status === 'published' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void despublicar()}
                  className={botaoSec}
                >
                  Despublicar
                </button>
              )}
              <button
                type="button"
                className={botaoSec}
                onClick={() => navigate(`/a/${artigo.id}`)}
              >
                Ver artigo
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void excluir()}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-400"
              >
                Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {dados && dados.versoes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Histórico de versões</h2>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {dados.versoes.map((v) => (
              <li
                key={v.versao}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span>
                  Versão {v.versao} ·{' '}
                  {new Date(v.criadoEm).toLocaleString('pt-BR')} ·{' '}
                  {v.origem === 'ia' ? 'IA' : 'manual'}
                </span>
                <button
                  type="button"
                  className={botaoSec}
                  onClick={() => restaurar(v)}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
