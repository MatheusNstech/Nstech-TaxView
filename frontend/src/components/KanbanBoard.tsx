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
import type { StatusObrigacao, WorkItem } from '../types'
import { KANBAN_COLUMNS } from '../types'
import KanbanCard from './KanbanCard'
import KanbanColumn from './KanbanColumn'

interface KanbanBoardProps {
  items: WorkItem[]
  onStatusChange: (item: WorkItem, status: StatusObrigacao) => Promise<void>
  onCardClick: (item: WorkItem) => void
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
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const grouped = useMemo(() => {
    const map: Record<string, WorkItem[]> = {
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

  const activeItem = items.find((i) => i.key === activeKey) ?? null

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly) return
    setActiveKey(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveKey(null)
    if (readOnly) return
    const { active, over } = event
    if (!over) return

    const itemKey = String(active.id)
    const overId = String(over.id)
    const current = items.find((i) => i.key === itemKey)
    if (!current) return

    const targetColumn = (
      KANBAN_COLUMNS.some((c) => c.id === overId)
        ? overId
        : columnFor(
            (items.find((i) => i.key === overId)?.status as StatusObrigacao) ??
              'PENDENTE',
          )
    ) as StatusObrigacao

    if (columnFor(current.status) === targetColumn) return
    await onStatusChange(current, targetColumn)
  }

  const board = (
    <div className="flex h-[calc(100dvh-11.5rem)] min-h-[22rem] gap-4 overflow-x-auto overflow-y-hidden pb-1">
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
            <KanbanCard item={activeItem} onClick={() => undefined} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
