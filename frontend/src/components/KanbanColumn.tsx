import { useDroppable } from '@dnd-kit/core'
import type { Obrigacao, StatusObrigacao } from '../types'
import KanbanCard from './KanbanCard'

interface KanbanColumnProps {
  id: StatusObrigacao
  label: string
  items: Obrigacao[]
  onCardClick: (item: Obrigacao) => void
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

  return (
    <div
      ref={setNodeRef}
      className={[
        'glass-panel flex min-h-[520px] w-80 shrink-0 flex-col',
        isOver ? 'ring-2 ring-brand-500/30' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">{label}</h3>
        <span className="glass-chip text-brand-700">{items.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-[color:var(--color-muted)]">
            Nenhuma obrigação
          </p>
        ) : (
          items.map((item) => (
            <KanbanCard
              key={item.id}
              obrigacao={item}
              onClick={() => onCardClick(item)}
              disableDrag={disableDrag}
            />
          ))
        )}
      </div>
    </div>
  )
}
