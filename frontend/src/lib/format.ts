export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
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

export function competenciaToMonth(competencia: string): string {
  return competencia.slice(0, 7)
}

/** Competência padrão do cronograma seedado (operação Ago/2026). */
export function currentCompetenciaMonth(): string {
  return '2026-08'
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
    ENTREGUE: 'Entregue',
    ATRASADO: 'Atrasado',
  }
  return labels[status] ?? status
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
