import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { JSONContent } from '@tiptap/react'
import { RichEditor } from '../../components/editor/RichEditor'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import {
  clearFlag,
  createArticle,
  deleteArticle,
  getArticle,
  listVersions,
  publishArticle,
  returnToDraft,
  saveArticle,
  sendToReview,
  unpublishArticle,
} from '../../services/articles'
import { getBlock } from '../../services/blocks'
import { getSuggestion } from '../../services/suggestions'
import type {
  Article,
  ArticleDraft,
  ArticlePublico,
  ArticleVersion,
  CategoriaId,
  Suggestion,
} from '../../types/content'
import { CATEGORIAS } from '../../utils/categorias'
import { EMPTY_DOC } from '../../utils/content'
import { rotuloDoStatus } from '../../utils/revisao'

const campo =
  'mt-1 w-full rounded-md border border-borda bg-cartao px-3 py-2 text-sm  '
const botaoSec =
  'rounded-md border border-borda px-3 py-1.5 text-sm disabled:opacity-50 '

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
      const sugestaoId = params.get('sugestao')
      const sugestao =
        artigo && sugestaoId ? await getSuggestion(artigo.id, sugestaoId) : null
      return { artigo, versoes, sugestao }
    }
    return {
      artigo: null as Article | null,
      versoes: [] as ArticleVersion[],
      sugestao: null as Suggestion | null,
    }
  }, [articleId, params])

  const [titulo, setTitulo] = useState('')
  const [publico, setPublico] = useState<ArticlePublico>('usuario')
  const [categoria, setCategoria] = useState<CategoriaId | ''>('')
  const [versaoProduto, setVersaoProduto] = useState('')
  const [conteudo, setConteudo] = useState<JSONContent>(EMPTY_DOC)
  const [editorKey, setEditorKey] = useState(0)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [falha, setFalha] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const artigo = dados?.artigo ?? null
  const sugestao = dados?.sugestao ?? null

  useEffect(() => {
    if (!artigo) return
    setTitulo(artigo.titulo)
    setPublico(artigo.publico)
    setCategoria(artigo.categoria ?? '')
    setVersaoProduto(artigo.versaoProduto ?? '')
    setConteudo(artigo.conteudo)
    // Vindo da revisão de uma sugestão, o editor abre com o texto da IA.
    if (sugestao && sugestao.status === 'pending') {
      setTitulo(sugestao.titulo)
      setConteudo(sugestao.conteudo)
    }
    setEditorKey((k) => k + 1)
  }, [artigo, sugestao])

  if (carregando && !dados) return <p className="text-suave">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-perigo ">
        {erro}
      </p>
    )
  if (articleId && !artigo) return <p>Artigo não encontrado.</p>

  const draft = (): ArticleDraft => ({
    titulo,
    conteudo,
    publico,
    categoria,
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

  const limparPrints = () =>
    executar(async () => {
      if (!artigo) return
      await clearFlag(artigo.id, 'prints_desatualizados', uid)
      recarregar()
      return 'Alerta de prints removido.'
    })

  const publicar = () =>
    executar(async () => {
      if (!artigo) throw new Error('Salve o rascunho antes de publicar.')
      const versao = await publishArticle(
        artigo,
        draft(),
        uid,
        sugestao?.status === 'pending' ? sugestao.id : undefined,
      )
      recarregar()
      return `Publicado (versão ${versao}).`
    })

  const enviarParaRevisao = () =>
    executar(async () => {
      if (!artigo) return
      // Grava o que está na tela antes: a fila mostra o texto salvo.
      await saveArticle(artigo.id, draft(), uid)
      await sendToReview(artigo.id, uid)
      recarregar()
      return 'Enviado para a fila de revisão.'
    })

  const devolverParaRascunho = () =>
    executar(async () => {
      if (!artigo) return
      await returnToDraft(artigo.id, uid)
      recarregar()
      return 'Artigo voltou para rascunho.'
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
      await deleteArticle(artigo.id, uid)
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
          <span className="ml-3 rounded bg-bloco px-2 py-0.5 text-xs font-normal ">
            {artigo.status === 'published'
              ? `Publicado v${artigo.versao}`
              : rotuloDoStatus(artigo.status)}
          </span>
        )}
      </h1>

      {sugestao?.status === 'pending' && (
        <p
          role="status"
          className="mb-4 rounded-md bg-bloco p-3 text-sm text-texto "
        >
          {sugestao.origem.tipo === 'ingestao'
            ? 'Editando a partir da atualização do arquivo'
            : 'Editando a partir da sugestão da IA'}{' '}
          ({sugestao.origem.arquivo}). Publicar aqui aprova a sugestão; nada
          muda até você publicar.
        </p>
      )}
      {artigo?.flags.includes('prints_desatualizados') && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-ambar-fundo p-3 text-sm text-ambar "
        >
          <span>Os prints deste artigo podem estar desatualizados.</span>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void limparPrints()}
            className="rounded-md border border-ambar/50 px-2 py-1"
          >
            Prints atualizados
          </button>
        </div>
      )}

      <div className="space-y-4">
        <label className="block text-sm">
          Título
          <input
            className={campo}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            Categoria
            <select
              className={campo}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaId | '')}
            >
              <option value="">Sem categoria</option>
              {CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
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
          <p role="alert" className="text-sm text-perigo ">
            {falha}
          </p>
        )}
        {mensagem && (
          <p role="status" className="text-sm text-sucesso ">
            {mensagem}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void salvar()}
            className="rounded-md bg-destaque px-3 py-1.5 text-sm font-medium text-white hover:bg-destaque/90 disabled:opacity-50"
          >
            {artigo ? 'Salvar' : 'Criar rascunho'}
          </button>
          {artigo && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void publicar()}
                className="rounded-md bg-destaque px-3 py-1.5 text-sm font-medium text-white hover:bg-destaque/90 disabled:opacity-50"
              >
                {artigo.status === 'review' ? 'Aprovar e publicar' : 'Publicar'}
              </button>
              {artigo.status === 'draft' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void enviarParaRevisao()}
                  className={botaoSec}
                >
                  Enviar para revisão
                </button>
              )}
              {artigo.status === 'review' && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void devolverParaRascunho()}
                  className={botaoSec}
                >
                  Devolver a rascunho
                </button>
              )}
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
                className="rounded-md border border-perigo/40 px-3 py-1.5 text-sm text-perigo disabled:opacity-50 "
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
          <ul className="divide-y divide-borda rounded-lg border border-borda bg-cartao ">
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
