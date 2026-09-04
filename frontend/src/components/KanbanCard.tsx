import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatDate } from '../lib/format'
import type { Obrigacao } from '../types'
import StatusBadge from './StatusBadge'

interface KanbanCardProps {
  obrigacao: Obrigacao
  onClick: () => void
  disableDrag?: boolean
}

export default function KanbanCard({
  obrigacao,
  onClick,
  disableDrag = false,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: obrigacao.id,
      data: { obrigacao },
      disabled: disableDrag,
    })

  const overdue =
    obrigacao.status !== 'ENTREGUE' &&
    (obrigacao.urgencia === 'atrasado' || obrigacao.status === 'ATRASADO')

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
          {obrigacao.empresa?.razao_social ?? 'Empresa'}
        </p>
        {overdue && (
          <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-600 dark:bg-rose-500/20 dark:text-rose-200">
            Atraso
          </span>
        )}
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-[color:var(--color-muted)]">
        {obrigacao.atividade?.nome ?? '—'}
      </p>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--color-muted)]">
        <span>{obrigacao.responsavel?.nome ?? 'Sem responsável'}</span>
        <span>{formatDate(obrigacao.prazo_fiscal ?? obrigacao.prazo_legal)}</span>
      </div>
      <StatusBadge status={obrigacao.status} urgencia={obrigacao.urgencia} />
    </div>
  )
}
