export function formatMoneyBRL(
  value: number | string | null | undefined,
): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

/** "09:00:00" or "09:00" → "09:00". Empty if missing. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  const [h, m] = value.split(':')
  if (h === undefined || m === undefined) return value
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}

/** Agenda da tarefa, sem efeito no atraso. Ex.: "09:00–12:00". */
export function formatHorario(
  inicio: string | null | undefined,
  fim: string | null | undefined,
): string | null {
  const a = formatTime(inicio)
  const b = formatTime(fim)
  if (!a || !b) return null
  return `${a}–${b}`
}

export function formatCompetencia(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m] = value.split('-')
  if (!y || !m) return value
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  return `${months[Number(m) - 1]}/${y}`
}

export function monthToCompetencia(month: string): string {
  return `${month}-01`
}

/**
 * Competência em trabalho ("YYYY-MM"), padrão dos filtros: o mês anterior ao
 * do calendário, porque em outubro se fecha a competência de setembro.
 */
export function currentCompetenciaMonth(): string {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}

export function nextCompetenciaDate(fromMonth?: string): string {
  const base = fromMonth ?? currentCompetenciaMonth()
  const [ys, ms] = base.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const next = new Date(y, m, 1) // Date month is 0-based; m is 1-based so this is next month
  const ny = next.getFullYear()
  const nm = String(next.getMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}-01`
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDENTE: 'Pendente',
    EM_ANDAMENTO: 'Em andamento',
    EM_REVISAO: 'Em revisão',
    ENTREGA_PARCIAL: 'Entrega parcial',
    ENTREGUE: 'Entregue',
    ATRASADO: 'Atrasado',
  }
  return labels[status] ?? status
}

/** Entrega parcial já conta como entregue (prazo e painéis). */
export function isEntregue(status: string | null | undefined): boolean {
  return status === 'ENTREGUE' || status === 'ENTREGA_PARCIAL'
}

/** Status para contagens: entrega parcial soma em Entregue. */
export function statusParaContagem<T extends string>(status: T): T | 'ENTREGUE' {
  return status === 'ENTREGA_PARCIAL' ? 'ENTREGUE' : status
}

export function urgenciaLabel(urgencia: string | null | undefined): string {
  const labels: Record<string, string> = {
    ok: 'No prazo',
    urgente: 'Urgente',
    atrasado: 'Atrasado',
    neutro: 'Sem prazo',
  }
  return labels[urgencia ?? ''] ?? urgencia ?? ''
}
