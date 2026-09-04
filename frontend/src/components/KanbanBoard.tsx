import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import type { Obrigacao, StatusObrigacao } from '../types'
import { KANBAN_COLUMNS } from '../types'
import KanbanCard from './KanbanCard'
import KanbanColumn from './KanbanColumn'

interface KanbanBoardProps {
  items: Obrigacao[]
  onStatusChange: (id: string, status: StatusObrigacao) => Promise<void>
  onCardClick: (item: Obrigacao) => void
  readOnly?: boolean
}

function columnFor(status: StatusObrigacao): StatusObrigacao {
  if (status === 'ATRASADO') return 'PENDENTE'
  return status
}

export default function KanbanBoard({
  items,
  onStatusChange,
  onCardClick,
  readOnly = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const grouped = useMemo(() => {
    const map: Record<string, Obrigacao[]> = {
      PENDENTE: [],
      EM_ANDAMENTO: [],
      EM_REVISAO: [],
      ENTREGUE: [],
    }
    for (const item of items) {
      const col = columnFor(item.status)
      map[col].push(item)
    }
    return map
  }, [items])

  const activeItem = items.find((i) => i.id === activeId) ?? null

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    if (readOnly) return
    const { active, over } = event
    if (!over) return

    const obrigacaoId = String(active.id)
    const overId = String(over.id)
    const targetColumn = (
      KANBAN_COLUMNS.some((c) => c.id === overId)
        ? overId
        : columnFor(
            (items.find((i) => i.id === overId)?.status as StatusObrigacao) ??
              'PENDENTE',
          )
    ) as StatusObrigacao

    const current = items.find((i) => i.id === obrigacaoId)
    if (!current || columnFor(current.status) === targetColumn) return

    await onStatusChange(obrigacaoId, targetColumn)
  }

  const board = (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          id={col.id}
          label={col.label}
          items={grouped[col.id] ?? []}
          onCardClick={onCardClick}
          disableDrag={readOnly}
        />
      ))}
    </div>
  )

  if (readOnly) {
    return board
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      {board}
      <DragOverlay>
        {activeItem ? (
          <div className="w-80">
            <KanbanCard obrigacao={activeItem} onClick={() => undefined} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
