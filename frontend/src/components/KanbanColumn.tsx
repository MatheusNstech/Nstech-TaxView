import { useDroppable } from '@dnd-kit/core'
import type { StatusObrigacao, WorkItem } from '../types'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  id: StatusObrigacao
  label: string
  items: WorkItem[]
  onCardClick: (item: WorkItem) => void
  disableDrag?: boolean
}

export default function KanbanColumn({
  id,
  label,
  items,
  onCardClick,
  disableDrag = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: disableDrag })

  const scrollClass = [
    'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3',
    '[scrollbar-width:thin]',
    '[scrollbar-color:#cbd5e1_transparent]',
    '[&::-webkit-scrollbar]:w-1.5',
    '[&::-webkit-scrollbar-track]:bg-transparent',
    '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300',
  ].join(' ')

  return (
    <div
      ref={setNodeRef}
      className={[
        'glass-panel flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden',
        isOver ? 'ring-2 ring-brand-500/30' : '',
      ].join(' ')}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--color-line)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">{label}</h3>
        <span className="glass-chip text-brand-700">{items.length}</span>
      </div>
      <div className={scrollClass}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-[color:var(--color-muted)]">
            Nenhuma tarefa
          </p>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.key}
              item={item}
              onClick={() => onCardClick(item)}
              disableDrag={disableDrag}
            />
          ))
        )}
      </div>
    </div>
  )
}
