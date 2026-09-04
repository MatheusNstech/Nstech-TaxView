import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatCompetencia } from '../lib/format'

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
]

interface GlassMonthPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
  align?: 'left' | 'right'
}

function parseMonth(value: string): { year: number; month: number } {
  const [y, m] = value.split('-').map(Number)
  const now = new Date()
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) ? m : now.getMonth() + 1,
  }
}

function toValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function GlassMonthPicker({
  value,
  onChange,
  className = '',
  ariaLabel = 'Competência',
  align = 'left',
}: GlassMonthPickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = useMemo(() => parseMonth(value), [value])
  const [viewYear, setViewYear] = useState(parsed.year)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (open) setViewYear(parsed.year)
  }, [open, parsed.year])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
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
  }, [open])

  const today = new Date()
  const thisMonth = toValue(today.getFullYear(), today.getMonth() + 1)

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'glass-control flex items-center gap-2 !pr-3 text-left transition-colors',
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'hover:border-brand-300',
        ].join(' ')}
      >
        <CalendarDays
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]"
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {formatCompetencia(`${value}-01`)}
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className={[
            'glass-dropdown absolute top-[calc(100%+0.35rem)] z-50 w-[17.5rem] p-3',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => setViewYear((y) => y - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-muted)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <p className="text-sm font-semibold text-[color:var(--color-ink)]">
              {viewYear}
            </p>
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => setViewYear((y) => y + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-muted)] transition-colors hover:bg-brand-500/10 hover:text-brand-600"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((month) => {
              const monthValue = toValue(viewYear, month.value)
              const isActive = monthValue === value
              return (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => {
                    onChange(monthValue)
                    setOpen(false)
                  }}
                  className={[
                    'rounded-xl px-2 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                      : 'text-[color:var(--color-ink)] hover:bg-brand-500/10 hover:text-brand-600',
                  ].join(' ')}
                >
                  {month.label}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[color:var(--color-line)] pt-2.5">
            <button
              type="button"
              onClick={() => {
                onChange(thisMonth)
                setOpen(false)
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-500/10 dark:text-brand-400"
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--nav-hover)]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
