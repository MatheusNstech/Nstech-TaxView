import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Copy, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import { formatDate, formatHorario } from '../lib/format'
import type { WorkItem } from '../types'
import EmpresaLogo from './empresas/EmpresaLogo'
import PersonAvatar from './PersonAvatar'
import { Selos, sinaisDe } from './SinaisItem'
import StatusBadge from './StatusBadge'

interface KanbanCardProps {
  item: WorkItem
  onClick: () => void
  disableDrag?: boolean
  onCopiar?: () => void
}

export function empresaDoItem(item: WorkItem) {
  return item.obrigacao?.empresa ?? item.tarefa?.empresa ?? null
}

function parar(e: PointerEvent | MouseEvent) {
  e.stopPropagation()
}

function MenuCard({ onCopiar }: { onCopiar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  return (
    <div ref={ref} className="relative" onPointerDown={parar} onClick={parar}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`rounded-md p-0.5 text-[color:var(--color-muted)] transition hover:bg-[color:var(--nav-hover)] hover:text-[color:var(--color-ink)] ${
          aberto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
        }`}
        aria-label="Mais ações"
        aria-expanded={aberto}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>
      {aberto && (
        <div className="glass-dropdown absolute right-0 top-6 z-30 w-52 p-1">
          <button
            type="button"
            onClick={() => {
              setAberto(false)
              onCopiar()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[color:var(--color-ink)] hover:bg-[color:var(--nav-hover)]"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            Copiar para outra empresa
          </button>
        </div>
      )}
    </div>
  )
}

export default function KanbanCard({
  item,
  onClick,
  disableDrag = false,
  onCopiar,
}: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.key,
      data: { item },
      disabled: disableDrag,
    })

  const sinais = sinaisDe(item)
  const empresa = empresaDoItem(item)
  const horario = formatHorario(item.horaInicio, item.horaFim)

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
        'group relative rounded-xl border p-3 shadow-sm transition hover:shadow-md',
        disableDrag ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        sinais.atrasado
          ? 'border-rose-300 ring-1 ring-rose-200 dark:border-rose-500/40 dark:ring-rose-500/20'
          : 'border-[color:var(--color-line)]',
      ].join(' ')}
    >
      <div className="mb-2 flex items-start gap-2.5">
        <EmpresaLogo empresa={empresa} size="sm" className="mt-0.5" />
        <p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-[color:var(--color-ink)]">
          {item.title}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {onCopiar && <MenuCard onCopiar={onCopiar} />}
          <Selos sinais={sinais} className="max-w-[5.5rem] flex-col items-end" />
        </div>
      </div>
      <p className="mb-2 line-clamp-2 text-xs text-[color:var(--color-muted)]">
        {item.subtitle}
      </p>
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--color-muted)]">
        <span className="flex min-w-0 items-center gap-1.5">
          {item.responsavelNome && <PersonAvatar nome={item.responsavelNome} size="xs" />}
          <span className="truncate">{item.responsavelNome ?? 'Sem responsável'}</span>
        </span>
        <span className="shrink-0">
          {formatDate(item.prazo)}
          {horario ? ` · ${horario}` : ''}
        </span>
      </div>
      <StatusBadge status={item.status} urgencia={item.urgencia} />
    </div>
  )
}
