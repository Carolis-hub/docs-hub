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
import { Link } from 'react-router-dom'
import type { Block } from '../types/content'

interface Props {
  blocos: Block[]
  /** Quando informado, os cards ficam arrastáveis (admin). */
  onReorder?: (ordenados: Block[]) => void
  onEdit?: (bloco: Block) => void
  onDelete?: (bloco: Block) => void
}

function Card({
  bloco,
  onEdit,
  onDelete,
  sortable,
}: { bloco: Block } & Pick<Props, 'onEdit' | 'onDelete'> & {
    sortable: boolean
  }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: bloco.id, disabled: !sortable })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <Link to={`/b/${bloco.id}`} className="flex-1">
        <span className="text-2xl" aria-hidden>
          {bloco.icone || '📁'}
        </span>
        <h3 className="mt-2 font-semibold">{bloco.nome}</h3>
        {bloco.descricao && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {bloco.descricao}
          </p>
        )}
      </Link>
      {sortable && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button
            type="button"
            aria-label={`Arrastar ${bloco.nome}`}
            className="cursor-grab rounded border border-slate-300 px-2 py-1 dark:border-slate-600"
            {...attributes}
            {...listeners}
          >
            ⠿ Mover
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(bloco)}
            className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(bloco)}
            className="rounded border border-red-300 px-2 py-1 text-red-700 dark:border-red-800 dark:text-red-400"
          >
            Excluir
          </button>
        </div>
      )}
    </li>
  )
}

export function BlockCards({ blocos, onReorder, onEdit, onDelete }: Props) {
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {blocos.map((b) => (
            <Card
              key={b.id}
              bloco={b}
              sortable={!!onReorder}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
