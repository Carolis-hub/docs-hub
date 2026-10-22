import { useState } from 'react'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import {
  createBlock,
  deleteBlock,
  listProducts,
  reorderBlocks,
  updateBlock,
} from '../services/blocks'
import type { Block } from '../types/content'

export function Home() {
  const { user, profile, isAdmin } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(
    () =>
      listProducts(isAdmin ? undefined : (profile?.produtosPermitidos ?? [])),
    [isAdmin, profile?.uid],
  )
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Block | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const produtos = dados ?? []

  async function reordenar(ordenados: Block[]) {
    await reorderBlocks(ordenados.map((b) => b.id))
    recarregar()
  }

  async function excluir(b: Block) {
    if (!window.confirm(`Excluir o produto "${b.nome}"?`)) return
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produtos</h1>
        {isAdmin && !criando && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Novo produto
          </button>
        )}
      </div>

      {criando && (
        <BlockForm
          titulo="Novo produto"
          onCancel={() => setCriando(false)}
          onSubmit={async (input) => {
            await createBlock(input, null, produtos.length, uid)
            setCriando(false)
            recarregar()
          }}
        />
      )}
      {editando && (
        <BlockForm
          titulo="Editar produto"
          inicial={editando}
          onCancel={() => setEditando(null)}
          onSubmit={async (input) => {
            await updateBlock(editando.id, input, uid)
            setEditando(null)
            recarregar()
          }}
        />
      )}
      {aviso && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          {aviso}
        </p>
      )}

      {carregando && <p className="text-slate-500">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
      {!carregando && !erro && produtos.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">
          {isAdmin
            ? 'Nenhum produto ainda. Crie o primeiro em "Novo produto".'
            : 'Você ainda não tem acesso a nenhum produto. Fale com um administrador.'}
        </p>
      )}
      {produtos.length > 0 && (
        <BlockCards
          blocos={produtos}
          onReorder={isAdmin ? (o) => void reordenar(o) : undefined}
          onEdit={setEditando}
          onDelete={(b) => void excluir(b)}
        />
      )}
    </div>
  )
}
