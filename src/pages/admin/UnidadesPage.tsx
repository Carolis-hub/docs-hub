import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { BlockForm } from '../../components/BlockForm'
import { PageHeader } from '../../components/PageHeader'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import {
  createUnidade,
  deleteUnidade,
  listUnidades,
  reorderUnidades,
  updateUnidade,
} from '../../services/unidades'
import type { Unidade } from '../../types/content'
import { Carregando } from '../../components/Carregando'

export function UnidadesPage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { dados, erro, carregando, recarregar } = useAsync(listUnidades, [])
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Unidade | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const unidades = dados ?? []

  async function mover(indice: number, delta: -1 | 1) {
    const ids = unidades.map((u) => u.id)
    const destino = indice + delta
    if (destino < 0 || destino >= ids.length) return
    const [movida] = ids.splice(indice, 1)
    ids.splice(destino, 0, movida as string)
    await reorderUnidades(ids)
    recarregar()
  }

  async function excluir(u: Unidade) {
    if (!window.confirm(`Excluir a unidade "${u.nome}"?`)) return
    try {
      await deleteUnidade(u.id, uid)
      setAviso(null)
      recarregar()
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não foi possível excluir.')
    }
  }

  return (
    <div>
      <PageHeader
        icone={Building2}
        titulo="Unidades de negócio"
        subtitulo="Agrupam os produtos na página inicial (BU → produto → subproduto)."
        acoes={
          !criando && (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="botao botao-primario"
            >
              <Plus className="size-4" aria-hidden />
              Nova unidade
            </button>
          )
        }
      />

      {criando && (
        <BlockForm
          titulo="Nova unidade"
          onCancel={() => setCriando(false)}
          onSubmit={async (input) => {
            await createUnidade(input, unidades.length, uid)
            setCriando(false)
            recarregar()
          }}
        />
      )}
      {editando && (
        <BlockForm
          titulo="Editar unidade"
          inicial={editando}
          onCancel={() => setEditando(null)}
          onSubmit={async (input) => {
            await updateUnidade(editando.id, input, uid)
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

      {carregando && !dados && <Carregando />}
      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {dados && unidades.length === 0 && (
        <p className="text-suave">
          Nenhuma unidade ainda. Crie a primeira em "Nova unidade" e depois
          escolha-a ao editar cada produto.
        </p>
      )}
      <ul className="space-y-3">
        {unidades.map((u, i) => (
          <li key={u.id} className="cartao flex items-center gap-4 p-4">
            <span className="tile size-10 text-lg" aria-hidden>
              {u.icone || <Building2 className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{u.nome}</p>
              {u.descricao && (
                <p className="truncate text-sm text-suave">{u.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="botao"
                aria-label={`Mover ${u.nome} para cima`}
                disabled={i === 0}
                onClick={() => void mover(i, -1)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="botao"
                aria-label={`Mover ${u.nome} para baixo`}
                disabled={i === unidades.length - 1}
                onClick={() => void mover(i, 1)}
              >
                <ArrowDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="botao"
                aria-label={`Editar ${u.nome}`}
                onClick={() => setEditando(u)}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                className="botao"
                aria-label={`Excluir ${u.nome}`}
                onClick={() => void excluir(u)}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
