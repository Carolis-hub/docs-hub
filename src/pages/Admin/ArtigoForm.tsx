import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { JSONContent } from '@tiptap/react'
import { useAuth } from '../../hooks/useAuth'
import { listAllBlocks } from '../../services/blocks'
import {
  createArticleDraft,
  getArticle,
  listVersions,
  publishArticle,
  restoreVersion,
  unpublishArticle,
  updateArticleDraft,
} from '../../services/articles'
import { montarOpcoesDeBloco } from '../../utils/blockTree'
import { ArticleEditor } from '../../components/editor/ArticleEditor'
import type { Block } from '../../types/block'
import type {
  Article,
  ArticlePublico,
  ArticleVersion,
} from '../../types/article'

const conteudoInicial: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function AdminArtigoForm() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [blocos, setBlocos] = useState<Block[]>([])
  const [artigo, setArtigo] = useState<Article | null>(null)
  const [versoes, setVersoes] = useState<ArticleVersion[]>([])
  const [editorKey, setEditorKey] = useState(0)

  const [blocoId, setBlocoId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [publico, setPublico] = useState<ArticlePublico>('usuario')
  const [versaoProduto, setVersaoProduto] = useState('')
  const [conteudo, setConteudo] = useState<JSONContent>(conteudoInicial)

  const [carregando, setCarregando] = useState(!!articleId)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    listAllBlocks()
      .catch(() => undefined)
      .then((lista) => lista && setBlocos(lista))
  }, [])

  useEffect(() => {
    if (!articleId) return

    setCarregando(true)
    Promise.all([getArticle(articleId), listVersions(articleId)])
      .then(([encontrado, historico]) => {
        if (!encontrado) {
          setErro('Artigo não encontrado.')
          return
        }
        setArtigo(encontrado)
        setBlocoId(encontrado.blockId)
        setTitulo(encontrado.titulo)
        setPublico(encontrado.publico)
        setVersaoProduto(encontrado.versaoProduto ?? '')
        setConteudo(encontrado.conteudo)
        setVersoes(historico)
      })
      .catch(() => setErro('Não foi possível carregar o artigo.'))
      .finally(() => setCarregando(false))
  }, [articleId])

  const opcoesDeBloco = useMemo(() => montarOpcoesDeBloco(blocos), [blocos])

  function blocoEscolhido(): Block | undefined {
    return blocos.find((bloco) => bloco.id === blocoId)
  }

  async function salvarRascunho(): Promise<string | null> {
    if (!user) return null

    if (!titulo.trim() || !blocoId) {
      setErro('Selecione um bloco e informe o título antes de salvar.')
      return null
    }

    setSalvando(true)
    setErro(null)
    try {
      if (!articleId) {
        const bloco = blocoEscolhido()
        if (!bloco) {
          setErro('Bloco inválido.')
          return null
        }
        const novoId = await createArticleDraft(
          {
            blockId: blocoId,
            productId: bloco.productId,
            titulo: titulo.trim(),
            conteudo,
            publico,
            versaoProduto: versaoProduto.trim() || null,
          },
          user.uid,
        )
        navigate(`/admin/artigos/${novoId}/editar`, { replace: true })
        setMensagem('Rascunho criado.')
        return novoId
      }

      await updateArticleDraft(
        articleId,
        {
          blockId: blocoId,
          titulo: titulo.trim(),
          conteudo,
          publico,
          versaoProduto: versaoProduto.trim() || null,
        },
        user.uid,
      )
      setMensagem('Rascunho salvo.')
      return articleId
    } catch {
      setErro('Não foi possível salvar o rascunho.')
      return null
    } finally {
      setSalvando(false)
    }
  }

  async function handlePublicar() {
    const id = await salvarRascunho()
    if (!id || !user) return

    setSalvando(true)
    try {
      await publishArticle(id, user.uid)
      const [atualizado, historico] = await Promise.all([
        getArticle(id),
        listVersions(id),
      ])
      if (atualizado) setArtigo(atualizado)
      setVersoes(historico)
      setMensagem('Artigo publicado.')
    } catch {
      setErro('Não foi possível publicar o artigo.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDespublicar() {
    if (!articleId || !user) return
    await unpublishArticle(articleId, user.uid)
    const atualizado = await getArticle(articleId)
    if (atualizado) setArtigo(atualizado)
    setMensagem('Artigo voltou para rascunho.')
  }

  async function handleRestaurar(versao: number) {
    if (!articleId || !user) return
    if (
      !window.confirm(
        `Restaurar a versão ${versao}? O rascunho atual será substituído.`,
      )
    ) {
      return
    }
    await restoreVersion(articleId, versao, user.uid)
    const atualizado = await getArticle(articleId)
    if (atualizado) {
      setArtigo(atualizado)
      setTitulo(atualizado.titulo)
      setConteudo(atualizado.conteudo)
      setEditorKey((chave) => chave + 1)
      setMensagem(`Versão ${versao} restaurada no rascunho.`)
    }
  }

  if (carregando) {
    return <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
      <div>
        <h1 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {articleId ? 'Editar artigo' : 'Novo artigo'}
        </h1>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="artigo-bloco"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Bloco
            </label>
            <select
              id="artigo-bloco"
              value={blocoId}
              onChange={(event) => setBlocoId(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Selecione…</option>
              {opcoesDeBloco.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.caminho}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="artigo-publico"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Público
            </label>
            <select
              id="artigo-publico"
              value={publico}
              onChange={(event) =>
                setPublico(event.target.value as ArticlePublico)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="usuario">Usuário</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="artigo-titulo"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Título
            </label>
            <input
              id="artigo-titulo"
              type="text"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="artigo-versao-produto"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Versão do produto (opcional)
            </label>
            <input
              id="artigo-versao-produto"
              type="text"
              value={versaoProduto}
              onChange={(event) => setVersaoProduto(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <ArticleEditor
          key={editorKey}
          conteudo={conteudo}
          onChange={setConteudo}
        />

        {erro && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-400"
          >
            {erro}
          </p>
        )}
        {mensagem && (
          <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
            {mensagem}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvarRascunho()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void handlePublicar()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            Publicar
          </button>
          {artigo?.status === 'published' && (
            <button
              type="button"
              onClick={() => void handleDespublicar()}
              className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Despublicar
            </button>
          )}
        </div>
      </div>

      <aside>
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Histórico de versões
        </h2>
        {versoes.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma versão publicada ainda.
          </p>
        )}
        <ul className="space-y-2">
          {versoes.map((versao) => (
            <li
              key={versao.versao}
              className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700"
            >
              <p className="font-medium text-slate-900 dark:text-slate-100">
                Versão {versao.versao}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {versao.origem === 'ia' ? 'Gerada por IA' : 'Manual'}
              </p>
              <button
                type="button"
                onClick={() => void handleRestaurar(versao.versao)}
                className="mt-1 text-slate-700 hover:underline dark:text-slate-300"
              >
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
