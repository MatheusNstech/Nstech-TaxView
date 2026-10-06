import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { GlassSelectOption } from './GlassSelect'

interface GlassMultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  options: GlassSelectOption[]
  icon: LucideIcon
  ariaLabel: string
  placeholder: string
  className?: string
  listClassName?: string
  align?: 'left' | 'right'
}

export default function GlassMultiSelect({
  values,
  onChange,
  options,
  icon: Icon,
  ariaLabel,
  placeholder,
  className = '',
  listClassName = '',
  align = 'left',
}: GlassMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.filter((o) => values.includes(o.value))
  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected[0].label} +${selected.length - 1}`

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

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    )
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={selected.length > 1 ? selected.map((o) => o.label).join(', ') : ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={[
          'glass-control flex items-center gap-2 !pr-2.5 text-left transition-colors',
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'hover:border-brand-300',
        ].join(' ')}
      >
        <Icon
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]"
          strokeWidth={1.75}
        />
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <ChevronDown
          className={[
            'h-3.5 w-3.5 shrink-0 text-[color:var(--color-muted)] transition-transform',
            open ? 'rotate-180 text-brand-600' : '',
          ].join(' ')}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div
          className={[
            'absolute top-[calc(100%+0.35rem)] z-[70] min-w-full overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl dark:bg-[color:var(--color-panel)]',
            align === 'right' ? 'right-0' : 'left-0',
            listClassName,
          ].join(' ')}
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable="true"
            className="max-h-56 overflow-auto py-1.5"
          >
            {options.map((option) => {
              const isActive = values.includes(option.value)
              return (
                <li key={option.value} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={[
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition duration-150',
                      isActive
                        ? 'font-semibold text-brand-600 dark:text-brand-400'
                        : 'text-[color:var(--color-ink)] hover:bg-brand-500/10',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                        isActive
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-slate-300 dark:border-white/25',
                      ].join(' ')}
                      aria-hidden
                    >
                      {isActive && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate leading-snug">
                      {option.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {values.length > 0 && (
            <div className="border-t border-[color:var(--color-line)] px-1.5 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-[color:var(--color-muted)] transition hover:bg-brand-500/10 hover:text-brand-600"
              >
                Limpar seleção (todos)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
