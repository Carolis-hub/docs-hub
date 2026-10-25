import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Folder,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Block } from '../types/content'

interface Props {
  blocos: Block[]
  /** `produto` mostra o ícone verde e a descrição; `pasta` é o cartão de seção. */
  variante?: 'produto' | 'pasta'
  /** Admin: mostra editar e excluir em cada cartão. */
  editavel?: boolean
  /** Admin: liga o arrastar para reordenar (só funciona com a lista inteira, sem filtro). */
  organizar?: boolean
  onReorder?: (ordenados: Block[]) => void
  onEdit?: (bloco: Block) => void
  onDelete?: (bloco: Block) => void
  /** Quando informado, o último cartão é o "+ Novo …" tracejado. */
  onNovo?: () => void
  rotuloNovo?: string
}

function Cartao({
  bloco,
  variante,
  editavel,
  organizar,
  onEdit,
  onDelete,
}: { bloco: Block } & Pick<
  Props,
  'variante' | 'editavel' | 'organizar' | 'onEdit' | 'onDelete'
>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bloco.id, disabled: !organizar })
  const produto = variante === 'produto'
  const Icone = produto ? Layers : Folder

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cartao flex items-center gap-2 p-3 ${isDragging ? 'z-10 shadow-xl' : ''}`}
    >
      {organizar && (
        <button
          type="button"
          aria-label={`Mover ${bloco.nome}`}
          className="botao-icone cursor-grab touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}
      <Link
        to={`/b/${bloco.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span
          className={`tile size-9 ${produto ? '' : 'tile-pasta'}`}
          aria-hidden
        >
          {bloco.icone ? bloco.icone : <Icone className="size-[18px]" />}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold leading-snug">{bloco.nome}</span>
          {produto && bloco.descricao && (
            <span className="mt-0.5 line-clamp-2 block text-sm text-suave">
              {bloco.descricao}
            </span>
          )}
        </span>
      </Link>
      {editavel && (
        <span className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Editar ${bloco.nome}`}
            title="Editar"
            onClick={() => onEdit?.(bloco)}
            className="botao-icone"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Excluir ${bloco.nome}`}
            title="Excluir"
            onClick={() => onDelete?.(bloco)}
            className="botao-icone hover:text-perigo"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </span>
      )}
    </li>
  )
}

export function BlockCards({
  blocos,
  variante = 'pasta',
  editavel = false,
  organizar = false,
  onReorder,
  onEdit,
  onDelete,
  onNovo,
  rotuloNovo = 'Novo subbloco',
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!onReorder || !over || active.id === over.id) return
    const de = blocos.findIndex((b) => b.id === active.id)
    const para = blocos.findIndex((b) => b.id === over.id)
    onReorder(arrayMove(blocos, de, para))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocos.map((b) => b.id)}
        strategy={rectSortingStrategy}
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blocos.map((b) => (
            <Cartao
              key={b.id}
              bloco={b}
              variante={variante}
              editavel={editavel}
              organizar={organizar}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {onNovo && (
            <li>
              <button
                type="button"
                onClick={onNovo}
                className="flex h-full min-h-[3.75rem] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-borda p-3 text-sm text-suave transition hover:border-destaque/60 hover:text-texto"
              >
                <span className="tile size-7">
                  <Plus className="size-4" aria-hidden />
                </span>
                {rotuloNovo}
              </button>
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
