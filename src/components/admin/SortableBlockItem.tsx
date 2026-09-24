import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block } from '../../types/block'

interface SortableBlockItemProps {
  bloco: Block
  onAbrir: () => void
  onEditar: () => void
  onExcluir: () => void
}

export function SortableBlockItem({
  bloco,
  onAbrir,
  onEditar,
  onExcluir,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bloco.id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 last:border-b-0 dark:border-slate-700 dark:bg-slate-800"
    >
      <button
        type="button"
        aria-label={`Reordenar ${bloco.nome}`}
        className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      <div className="flex-1">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {bloco.nome}
        </p>
        {bloco.descricao && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {bloco.descricao}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onAbrir}
        className="rounded-md px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Abrir
      </button>
      <button
        type="button"
        onClick={onEditar}
        className="rounded-md px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Editar
      </button>
      <button
        type="button"
        onClick={onExcluir}
        className="rounded-md px-2.5 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        Excluir
      </button>
    </li>
  )
}
