import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatDate } from '../lib/format'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

interface GlassDatePickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
  align?: 'left' | 'right'
  placeholder?: string
  /** Calendar sits in document flow (no absolute overlay). */
  inline?: boolean
  /** Dropdown opens above the trigger (avoids clipping). */
  placement?: 'bottom' | 'top'
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIso(value: string): { year: number; month: number; day: number } | null {
  if (!value || value.length < 10) return null
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  return { year: y, month: m, day: d }
}

function todayIso(): string {
  const t = new Date()
  return toIso(t.getFullYear(), t.getMonth() + 1, t.getDate())
}

export default function GlassDatePicker({
  value,
  onChange,
  className = '',
  ariaLabel = 'Data',
  align = 'left',
  placeholder = 'dd/mm/aaaa',
  inline = false,
  placement = 'bottom',
}: GlassDatePickerProps) {
  const [open, setOpen] = useState(inline)
  const parsed = useMemo(() => parseIso(value), [value])
  const now = new Date()
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth() + 1)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (inline) setOpen(true)
  }, [inline])

  useEffect(() => {
    if (!open || inline) return
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
  }, [open, parsed, inline])

  useEffect(() => {
    if (!open || inline) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, inline])

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1)
    const startPad = first.getDay()
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
    const prevDays = new Date(viewYear, viewMonth - 1, 0).getDate()
    const items: { day: number; inMonth: boolean; iso: string }[] = []

    for (let i = startPad - 1; i >= 0; i -= 1) {
      const day = prevDays - i
      const m = viewMonth === 1 ? 12 : viewMonth - 1
      const y = viewMonth === 1 ? viewYear - 1 : viewYear
      items.push({ day, inMonth: false, iso: toIso(y, m, day) })
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      items.push({ day, inMonth: true, iso: toIso(viewYear, viewMonth, day) })
    }
    const trailing = (7 - (items.length % 7)) % 7
    for (let day = 1; day <= trailing; day += 1) {
      const m = viewMonth === 12 ? 1 : viewMonth + 1
      const y = viewMonth === 12 ? viewYear + 1 : viewYear
      items.push({ day, inMonth: false, iso: toIso(y, m, day) })
    }
    return items
  }, [viewYear, viewMonth])

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth() + 1)
  }

  const today = todayIso()
  const display = value ? formatDate(value) : placeholder

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {!inline ? (
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className={[
            'glass-control flex items-center gap-2 !pr-3 text-left transition-colors',
            open
              ? 'border-brand-500 ring-2 ring-brand-500/20'
              : 'hover:border-brand-300',
            !value ? 'text-[color:var(--color-muted)]' : '',
          ].join(' ')}
        >
          <CalendarDays
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]"
            strokeWidth={1.75}
          />
          <span className="min-w-0 flex-1 truncate font-medium">{display}</span>
        </button>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className={[
            'z-[70] rounded-2xl border border-[color:var(--color-line)] bg-white p-3 shadow-sm dark:bg-[color:var(--color-panel)]',
            inline
              ? 'relative mt-0 w-full'
              : [
                  'absolute z-[70] w-[17.5rem] shadow-xl',
                  placement === 'top'
                    ? 'bottom-[calc(100%+0.35rem)]'
                    : 'top-[calc(100%+0.35rem)]',
                  align === 'right' ? 'right-0' : 'left-0',
                ].join(' '),
          ].join(' ')}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-muted)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <p className="text-sm font-semibold capitalize text-[color:var(--color-ink)]">
              {MONTH_NAMES[viewMonth - 1]} de {viewYear}
            </p>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-muted)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase text-[color:var(--color-muted)]">
            {WEEKDAYS.map((d, i) => (
              <div key={`${d}-${i}`} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell) => {
              const isSelected = cell.iso === value
              const isToday = cell.iso === today
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso)
                    if (!inline) setOpen(false)
                  }}
                  className={[
                    'aspect-square rounded-lg text-xs font-medium transition-colors',
                    !cell.inMonth
                      ? 'text-[color:var(--color-muted)]/45'
                      : 'text-[color:var(--color-ink)]',
                    isSelected
                      ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                      : isToday
                        ? 'ring-1 ring-brand-500/40 hover:bg-brand-500/10'
                        : 'hover:bg-brand-500/10 hover:text-brand-600',
                  ].join(' ')}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-[color:var(--color-line)] pt-2">
            <button
              type="button"
              onClick={() => {
                onChange('')
                if (!inline) setOpen(false)
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(today)
                if (!inline) setOpen(false)
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10"
            >
              Hoje
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
