import { useState } from 'react'
import { Layers, Plus } from 'lucide-react'
import { BlockCards } from '../components/BlockCards'
import { BlockForm } from '../components/BlockForm'
import { Interruptor } from '../components/ListToolbar'
import { PageHeader } from '../components/PageHeader'
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
  const [organizar, setOrganizar] = useState(false)
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
      <PageHeader
        icone={Layers}
        titulo="Produtos"
        subtitulo={
          produtos.length > 0
            ? `${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'} de documentação`
            : undefined
        }
        acoes={
          isAdmin && (
            <>
              {produtos.length > 1 && (
                <Interruptor
                  ligado={organizar}
                  aoMudar={setOrganizar}
                  rotulo="Organizar"
                />
              )}
              {!criando && (
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="botao botao-primario"
                >
                  <Plus className="size-4" aria-hidden />
                  Novo produto
                </button>
              )}
            </>
          )
        }
      />

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
        <p role="alert" className="mb-4 text-sm text-perigo">
          {aviso}
        </p>
      )}

      {carregando && <p className="text-suave">Carregando…</p>}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {!carregando && !erro && produtos.length === 0 && (
        <p className="text-suave">
          {isAdmin
            ? 'Nenhum produto ainda. Crie o primeiro em "Novo produto".'
            : 'Você ainda não tem acesso a nenhum produto. Fale com um administrador.'}
        </p>
      )}
      {produtos.length > 0 && (
        <BlockCards
          blocos={produtos}
          variante="produto"
          editavel={isAdmin}
          organizar={isAdmin && organizar}
          onReorder={isAdmin ? (o) => void reordenar(o) : undefined}
          onEdit={setEditando}
          onDelete={(b) => void excluir(b)}
        />
      )}
    </div>
  )
}
