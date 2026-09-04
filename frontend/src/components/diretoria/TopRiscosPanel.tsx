import { AlertTriangle, CalendarClock, UserRound } from 'lucide-react'
import StatusBadge from '../StatusBadge'
import type { Obrigacao } from '../../types'
import { formatDate } from '../../lib/format'

export interface DiretoriaRisco {
  id: string
  tipo: 'atrasado' | 'vence_7d' | 'sobrecarga'
  titulo: string
  detalhe: string
  obrigacao?: Obrigacao
  responsavelNome?: string
}

interface TopRiscosPanelProps {
  items: DiretoriaRisco[]
  onSelect?: (risco: DiretoriaRisco) => void
}

function iconFor(tipo: DiretoriaRisco['tipo']) {
  if (tipo === 'atrasado') return AlertTriangle
  if (tipo === 'vence_7d') return CalendarClock
  return UserRound
}

function toneFor(tipo: DiretoriaRisco['tipo']) {
  if (tipo === 'atrasado') return 'text-[#FF5630] bg-[#FF5630]/15'
  if (tipo === 'vence_7d') return 'text-[#B76E00] bg-[#FFAB00]/20'
  return 'text-[#006C9C] bg-[#00B8D9]/15'
}

export default function TopRiscosPanel({ items, onSelect }: TopRiscosPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center text-sm text-[color:var(--color-muted)]">
        Sem pendências críticas na competência
      </div>
    )
  }

  return (
    <ul className="divide-y divide-[color:var(--color-line)]">
      {items.map((item) => {
        const Icon = iconFor(item.tipo)
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect?.(item)}
              className="flex w-full items-start gap-3 rounded-xl px-1 py-3 text-left transition hover:bg-[color:var(--nav-hover)]"
            >
              <div
                className={[
                  'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  toneFor(item.tipo),
                ].join(' ')}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[color:var(--color-ink)]">
                    {item.titulo}
                  </p>
                  {item.obrigacao && (
                    <StatusBadge
                      status={item.obrigacao.status}
                      urgencia={item.obrigacao.urgencia}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                  {item.detalhe}
                  {item.obrigacao?.prazo_fiscal || item.obrigacao?.prazo_legal
                    ? ` · prazo ${formatDate(item.obrigacao.prazo_fiscal ?? item.obrigacao.prazo_legal)}`
                    : ''}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
