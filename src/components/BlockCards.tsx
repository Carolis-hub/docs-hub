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
  /** Subprodutos de cada produto (id do produto → blocos), mostrados no cartão. */
  subprodutos?: Record<string, Block[]>
  /** Linha de resumo de cada cartão (id → texto), ex.: "2 subprodutos · 8 artigos". */
  resumos?: Record<string, string>
}

function Cartao({
  bloco,
  variante,
  editavel,
  organizar,
  onEdit,
  onDelete,
  filhos,
  resumo,
}: { bloco: Block; filhos?: Block[]; resumo?: string } & Pick<
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

  if (produto) {
    return (
      <li
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`cartao flex flex-col gap-3 p-5 transition hover:border-destaque/50 ${isDragging ? 'z-10 shadow-xl' : ''}`}
      >
        <div className="flex items-start gap-2">
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
            className="flex min-w-0 flex-1 items-start gap-3.5"
          >
            <span className="tile size-12 text-xl" aria-hidden>
              {bloco.icone ? bloco.icone : <Icone className="size-6" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-destaque">
                Produto
              </span>
              <span className="mt-0.5 block text-xl font-extrabold leading-tight tracking-tight">
                {bloco.nome}
              </span>
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
        </div>
        <p
          className={`line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed ${bloco.descricao ? 'text-texto/80' : 'italic text-suave'}`}
        >
          {bloco.descricao ||
            (editavel
              ? 'Sem descrição. Use Editar para escrever uma breve descrição do produto.'
              : 'Sem descrição.')}
        </p>
        {resumo && <p className="text-xs text-suave">{resumo}</p>}
        {filhos && filhos.length > 0 && (
          <ul
            aria-label={`Subprodutos de ${bloco.nome}`}
            className="flex flex-wrap gap-1.5 rounded-xl bg-fundo p-3"
          >
            {filhos.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/b/${f.id}`}
                  className="selo transition hover:text-texto"
                >
                  {f.nome}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cartao flex flex-wrap items-center gap-2 p-3 ${isDragging ? 'z-10 shadow-xl' : ''}`}
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
      {resumo && (
        <p className="w-full basis-full pl-12 text-xs text-suave">{resumo}</p>
      )}
      {filhos && filhos.length > 0 && (
        <ul
          aria-label={`Subprodutos de ${bloco.nome}`}
          className="flex w-full basis-full flex-wrap gap-1.5 border-t border-borda pt-2"
        >
          {filhos.map((f) => (
            <li key={f.id}>
              <Link
                to={`/b/${f.id}`}
                className="selo transition hover:text-texto"
              >
                {f.nome}
              </Link>
            </li>
          ))}
        </ul>
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
  subprodutos,
  resumos,
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
        <ul
          className={
            variante === 'produto'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {blocos.map((b) => (
            <Cartao
              key={b.id}
              bloco={b}
              variante={variante}
              editavel={editavel}
              organizar={organizar}
              onEdit={onEdit}
              onDelete={onDelete}
              filhos={subprodutos?.[b.id]}
              resumo={resumos?.[b.id]}
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
