import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export interface GlassSelectOption {
  value: string
  label: string
}

interface GlassSelectProps {
  value: string
  onChange: (value: string) => void
  options: GlassSelectOption[]
  icon: LucideIcon
  ariaLabel: string
  className?: string
  placeholder?: string
}

export default function GlassSelect({
  value,
  onChange,
  options,
  icon: Icon,
  ariaLabel,
  className = '',
  placeholder,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const display = selected?.label ?? placeholder ?? 'Selecionar'

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

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={ariaLabel}
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
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="glass-dropdown absolute top-[calc(100%+0.35rem)] left-0 z-50 max-h-64 min-w-full overflow-auto rounded-2xl py-1.5"
        >
          {options.map((option) => {
            const isActive = option.value === value
            return (
              <li key={option.value || '__empty'} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                    className={[
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition duration-150',
                      isActive
                        ? 'bg-brand-500/12 font-semibold text-brand-600 dark:text-brand-400'
                        : 'text-[color:var(--color-ink)] hover:bg-brand-500/10 hover:shadow-sm',
                    ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {isActive && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" strokeWidth={2} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
