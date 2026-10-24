import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { Breadcrumb } from '../components/Breadcrumb'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import {
  createBlock,
  deleteBlock,
  getAncestors,
  getBlock,
  listChildren,
  reorderBlocks,
  updateBlock,
} from '../services/blocks'
import { listArticlesByBlock } from '../services/articles'
import type { Block } from '../types/content'

export function BlockPage() {
  const { blockId = '' } = useParams()
  const { user, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(async () => {
    const bloco = await getBlock(blockId)
    if (!bloco) return null
    const [cadeia, filhos, artigos] = await Promise.all([
      getAncestors(bloco),
      listChildren(blockId),
      listArticlesByBlock(blockId, !isAdmin),
    ])
    return { bloco, cadeia, filhos, artigos }
  }, [blockId, isAdmin])

  const [modo, setModo] = useState<'novo' | 'editar' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [editandoFilho, setEditandoFilho] = useState<Block | null>(null)

  if (carregando && !dados) return <p className="text-slate-500">Carregando…</p>
  if (erro)
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {erro}
      </p>
    )
  if (!dados) return <p>Bloco não encontrado.</p>

  const { bloco, cadeia, filhos, artigos } = dados

  async function excluirFilho(b: Block) {
    if (!window.confirm(`Excluir "${b.nome}"?`)) return
    try {
      await deleteBlock(b.id, uid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div>
      <Breadcrumb cadeia={cadeia} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            <span aria-hidden>{bloco.icone} </span>
            {bloco.nome}
          </h1>
          {bloco.descricao && (
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              {bloco.descricao}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setModo('editar')}
              className="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-600"
            >
              Editar bloco
            </button>
            <button
              type="button"
              onClick={() => setModo('novo')}
              className="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-600"
            >
              Novo subbloco
            </button>
            <Link
              to={`/admin/artigos/novo?blockId=${bloco.id}`}
              className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Novo artigo
            </Link>
          </div>
        )}
      </div>

      {modo === 'novo' && (
        <BlockForm
          titulo="Novo subbloco"
          onCancel={() => setModo(null)}
          onSubmit={async (input) => {
            await createBlock(input, bloco, filhos.length, uid)
            setModo(null)
            recarregar()
          }}
        />
      )}
      {modo === 'editar' && (
        <BlockForm
          titulo="Editar bloco"
          inicial={bloco}
          onCancel={() => setModo(null)}
          onSubmit={async (input) => {
            await updateBlock(bloco.id, input, uid)
            setModo(null)
            recarregar()
          }}
        />
      )}
      {editandoFilho && (
        <BlockForm
          titulo="Editar subbloco"
          inicial={editandoFilho}
          onCancel={() => setEditandoFilho(null)}
          onSubmit={async (input) => {
            await updateBlock(editandoFilho.id, input, uid)
            setEditandoFilho(null)
            recarregar()
          }}
        />
      )}
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {aviso}
        </p>
      )}

      {filhos.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Subprodutos e seções</h2>
          <BlockCards
            blocos={filhos}
            onReorder={
              isAdmin
                ? (o) => void reorderBlocks(o.map((b) => b.id)).then(recarregar)
                : undefined
            }
            onEdit={setEditandoFilho}
            onDelete={(b) => void excluirFilho(b)}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Artigos</h2>
        {artigos.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            Nenhum artigo neste bloco.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
            {artigos.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/a/${a.id}`}
                  className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="font-medium">{a.titulo}</span>
                  {isAdmin && a.status === 'draft' && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      Rascunho
                    </span>
                  )}
                  {a.publico === 'tecnico' && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                      Técnico
                    </span>
                  )}
                  {a.resumo && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {a.resumo}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
