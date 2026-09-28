import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllBlocks } from '../../services/blocks'
import { deleteArticle, listArticlesByBlock } from '../../services/articles'
import { montarOpcoesDeBloco } from '../../utils/blockTree'
import { useAuth } from '../../hooks/useAuth'
import type { Block } from '../../types/block'
import type { Article } from '../../types/article'

const rotuloStatus: Record<Article['status'], string> = {
  draft: 'Rascunho',
  published: 'Publicado',
}

export function AdminArtigos() {
  const { user } = useAuth()
  const [blocos, setBlocos] = useState<Block[]>([])
  const [blocoSelecionado, setBlocoSelecionado] = useState('')
  const [artigos, setArtigos] = useState<Article[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listAllBlocks()
      .then(setBlocos)
      .catch(() => setErro('Não foi possível carregar os blocos.'))
  }, [])

  const opcoesDeBloco = useMemo(() => montarOpcoesDeBloco(blocos), [blocos])

  useEffect(() => {
    if (!blocoSelecionado) {
      setArtigos([])
      return
    }
    setCarregando(true)
    listArticlesByBlock(blocoSelecionado)
      .then(setArtigos)
      .catch(() => setErro('Não foi possível carregar os artigos.'))
      .finally(() => setCarregando(false))
  }, [blocoSelecionado])

  async function handleExcluir(artigo: Article) {
    if (!user) return
    if (!window.confirm(`Excluir o artigo "${artigo.titulo}"?`)) return
    await deleteArticle(artigo.id, user.uid)
    setArtigos((atual) => atual.filter((item) => item.id !== artigo.id))
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Artigos
        </h1>
        <Link
          to="/admin/artigos/novo"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          Novo artigo
        </Link>
      </div>

      <div className="mb-6">
        <label
          htmlFor="bloco-filtro"
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Bloco
        </label>
        <select
          id="bloco-filtro"
          value={blocoSelecionado}
          onChange={(event) => setBlocoSelecionado(event.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Selecione um bloco…</option>
          {opcoesDeBloco.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.caminho}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p role="alert" className="mb-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {!carregando && blocoSelecionado && artigos.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">
          Nenhum artigo neste bloco ainda.
        </p>
      )}

      {artigos.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {artigos.map((artigo) => (
            <li
              key={artigo.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {artigo.titulo}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {rotuloStatus[artigo.status]}
                  {artigo.publico === 'tecnico' ? ' · Técnico' : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/admin/artigos/${artigo.id}/editar`}
                  className="rounded-md px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => void handleExcluir(artigo)}
                  className="rounded-md px-2.5 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
