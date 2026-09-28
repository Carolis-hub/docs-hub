import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  createBlock,
  deleteBlock,
  getBreadcrumb,
  listChildren,
  listProducts,
  reorderBlocks,
  updateBlock,
} from '../../services/blocks'
import { Breadcrumb } from '../../components/Breadcrumb'
import {
  BlockForm,
  type BlockFormValues,
} from '../../components/admin/BlockForm'
import { SortableBlockItem } from '../../components/admin/SortableBlockItem'
import { useAuth } from '../../hooks/useAuth'
import type { Block } from '../../types/block'

export function AdminBlocos() {
  const { user } = useAuth()
  const [parentId, setParentId] = useState<string | null>(null)
  const [trilha, setTrilha] = useState<Block[]>([])
  const [itens, setItens] = useState<Block[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<
    { modo: 'criar' } | { modo: 'editar'; bloco: Block } | null
  >(null)

  const carregar = useCallback(() => {
    setCarregando(true)
    setErro(null)

    const carregarItens = parentId ? listChildren(parentId) : listProducts()
    const carregarTrilha = parentId
      ? getBreadcrumb(parentId)
      : Promise.resolve<Block[]>([])

    Promise.all([carregarItens, carregarTrilha])
      .then(([filhos, breadcrumb]) => {
        setItens(filhos)
        setTrilha(breadcrumb)
      })
      .catch(() => setErro('Não foi possível carregar os blocos.'))
      .finally(() => setCarregando(false))
  }, [parentId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const sensors = useSensors(useSensor(PointerSensor))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const indiceAntigo = itens.findIndex((item) => item.id === active.id)
    const indiceNovo = itens.findIndex((item) => item.id === over.id)
    const reordenados = arrayMove(itens, indiceAntigo, indiceNovo)
    setItens(reordenados)

    await reorderBlocks(
      reordenados.map((item, indice) => ({ id: item.id, ordem: indice })),
    )
  }

  async function handleCriar(valores: BlockFormValues) {
    if (!user) return
    await createBlock({ ...valores, parentId }, user.uid)
    setFormulario(null)
    carregar()
  }

  async function handleEditar(bloco: Block, valores: BlockFormValues) {
    if (!user) return
    await updateBlock(bloco.id, valores, user.uid)
    setFormulario(null)
    carregar()
  }

  async function handleExcluir(bloco: Block) {
    if (!user) return
    if (
      !window.confirm(
        `Excluir "${bloco.nome}"? Essa ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    try {
      await deleteBlock(bloco.id, user.uid)
      carregar()
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o bloco.',
      )
    }
  }

  const nivel = trilha.length

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Blocos
          </h1>
          {trilha.length > 0 && (
            <Breadcrumb
              raiz={{ label: 'Produtos', onClick: () => setParentId(null) }}
              itens={trilha.map((bloco, indice) => ({
                label: bloco.nome,
                onClick:
                  indice < trilha.length - 1
                    ? () => setParentId(bloco.id)
                    : undefined,
              }))}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => setFormulario({ modo: 'criar' })}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        >
          {nivel === 0 ? 'Novo produto' : 'Novo bloco'}
        </button>
      </div>

      {erro && (
        <p role="alert" className="mb-4 text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}

      {carregando && (
        <p className="text-slate-500 dark:text-slate-400">Carregando…</p>
      )}

      {!carregando && itens.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400">
          Nenhum bloco cadastrado neste nível.
        </p>
      )}

      {!carregando && itens.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <SortableContext
            items={itens.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              {itens.map((item) => (
                <SortableBlockItem
                  key={item.id}
                  bloco={item}
                  onAbrir={() => setParentId(item.id)}
                  onEditar={() =>
                    setFormulario({ modo: 'editar', bloco: item })
                  }
                  onExcluir={() => void handleExcluir(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {formulario?.modo === 'criar' && (
        <BlockForm
          titulo={nivel === 0 ? 'Novo produto' : 'Novo bloco'}
          onSalvar={handleCriar}
          onCancelar={() => setFormulario(null)}
        />
      )}
      {formulario?.modo === 'editar' && (
        <BlockForm
          titulo="Editar bloco"
          blocoInicial={formulario.bloco}
          onSalvar={(valores) => handleEditar(formulario.bloco, valores)}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </div>
  )
}
