import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatDate, formatHorario } from '../lib/format'
import type { WorkItem } from '../types'
import StatusBadge from './StatusBadge'

interface KanbanCardProps {
  item: WorkItem
  onClick: () => void
  disableDrag?: boolean
}

export default function KanbanCard({
  item,
  onClick,
  disableDrag = false,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.key,
      data: { item },
      disabled: disableDrag,
    })

  const overdue =
    item.status !== 'ENTREGUE' &&
    (item.urgencia === 'atrasado' || item.status === 'ATRASADO')

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    background: 'var(--color-panel)',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disableDrag ? {} : { ...listeners, ...attributes })}
      onClick={onClick}
      className={[
        'rounded-xl border p-3 shadow-sm transition hover:shadow-md',
        disableDrag ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        overdue
          ? 'border-rose-300 ring-1 ring-rose-200 dark:border-rose-500/40 dark:ring-rose-500/20'
          : 'border-[color:var(--color-line)]',
      ].join(' ')}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-[color:var(--color-ink)]">
          {item.title}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {item.origem === 'tarefa' ? (
            <span className="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">
              Tarefa
            </span>
          ) : null}
          {overdue ? (
            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
              Atraso
            </span>
          ) : null}
        </div>
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-[color:var(--color-muted)]">
        {item.subtitle}
      </p>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--color-muted)]">
        <span>{item.responsavelNome ?? 'Sem responsável'}</span>
        <span>
          {formatDate(item.prazo)}
          {formatHorario(item.horaInicio, item.horaFim)
            ? ` · ${formatHorario(item.horaInicio, item.horaFim)}`
            : ''}
        </span>
      </div>
      <StatusBadge status={item.status} urgencia={item.urgencia} />
    </div>
  )
}
