import { formatCompetencia } from './format'

export type TipoValor = 'iss' | 'pis_cofins'

export interface ValorRow {
  id: string
  competencia: string
  tipo: TipoValor
  empresa_cnpj: string
  empresa_alias: string
  empresa_razao: string
  origem: string
  payload: Record<string, unknown>
  updated_at: string | null
  created_at: string | null
}

export interface EmpresaOption {
  cnpj: string
  alias: string
  razao: string
}

export interface EmpresaMonthMetrics {
  faturamento: number | null
  erpIss: number | null
  issRecolher: number | null
  pis: number | null
  cofins: number | null
  pisCofins: number | null
  issRow: ValorRow | null
  pisRow: ValorRow | null
  updatedAt: string | null
}

export interface ChartPoint {
  competencia: string
  label: string
  faturamento: number
}

export function num(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const v = payload[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length === 14) {
    return d.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    )
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return digits
}

export function maskCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length >= 4) {
    return `**** **** **** ${d.slice(-4)}`
  }
  return formatCnpj(digits)
}

function competenciaKey(value: string): string {
  return value.slice(0, 7)
}

export function groupEmpresas(rows: ValorRow[]): EmpresaOption[] {
  const map = new Map<string, EmpresaOption>()
  for (const row of rows) {
    const cnpj = row.empresa_cnpj.replace(/\D/g, '')
    if (!cnpj) continue
    const prev = map.get(cnpj)
    if (!prev) {
      map.set(cnpj, {
        cnpj,
        alias: row.empresa_alias || row.empresa_razao || cnpj,
        razao: row.empresa_razao || '',
      })
      continue
    }
    if (!prev.alias && row.empresa_alias) prev.alias = row.empresa_alias
    if (!prev.razao && row.empresa_razao) prev.razao = row.empresa_razao
  }
  return [...map.values()].sort((a, b) =>
    a.alias.localeCompare(b.alias, 'pt-BR'),
  )
}

export function metricsForEmpresaMonth(
  rows: ValorRow[],
  cnpj: string,
  competenciaIso: string,
): EmpresaMonthMetrics {
  const digits = cnpj.replace(/\D/g, '')
  const month = competenciaKey(competenciaIso)
  const scoped = rows.filter(
    (r) =>
      r.empresa_cnpj.replace(/\D/g, '') === digits &&
      competenciaKey(r.competencia) === month,
  )
  const issRow = scoped.find((r) => r.tipo === 'iss') ?? null
  const pisRow = scoped.find((r) => r.tipo === 'pis_cofins') ?? null

  const erpValor = issRow ? num(issRow.payload, 'erp_valor') : null
  const receitaPis = pisRow
    ? (num(pisRow.payload, 'receita_bruta') ?? num(pisRow.payload, 'erp_valor'))
    : null
  const faturamento = erpValor ?? receitaPis

  const erpIss = issRow ? num(issRow.payload, 'erp_iss') : null
  const issRecolher = issRow
    ? (num(issRow.payload, 'iss_a_recolher') ?? erpIss)
    : null

  const pis = pisRow
    ? (num(pisRow.payload, 'pis_debito') ?? num(pisRow.payload, 'pis'))
    : null
  const cofins = pisRow
    ? (num(pisRow.payload, 'cofins_debito') ?? num(pisRow.payload, 'cofins'))
    : null
  const pisCofins =
    pis == null && cofins == null
      ? null
      : (pis ?? 0) + (cofins ?? 0)

  const stamps = [issRow?.updated_at, issRow?.created_at, pisRow?.updated_at, pisRow?.created_at]
    .filter(Boolean)
    .map((s) => new Date(s as string).getTime())
    .filter((t) => Number.isFinite(t))
  const updatedAt =
    stamps.length > 0
      ? new Date(Math.max(...stamps)).toISOString()
      : null

  return {
    faturamento,
    erpIss,
    issRecolher,
    pis,
    cofins,
    pisCofins,
    issRow,
    pisRow,
    updatedAt,
  }
}

export function previousCompetenciaIso(competenciaIso: string): string {
  const [ys, ms] = competenciaIso.slice(0, 7).split('-')
  const y = Number(ys)
  const m = Number(ms)
  const prev = new Date(y, m - 2, 1)
  const ny = prev.getFullYear()
  const nm = String(prev.getMonth() + 1).padStart(2, '0')
  return `${ny}-${nm}-01`
}

export function deltaPercent(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null || previous === 0) return null
  // Evita % absurdo quando o mês anterior era smoke/quase zero
  if (Math.abs(previous) < 1) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) > 500) return null
  return pct
}

export function buildFaturamentoSeries(
  historyRows: ValorRow[],
  cnpj: string,
  maxMonths = 12,
): ChartPoint[] {
  const digits = cnpj.replace(/\D/g, '')
  const byMonth = new Map<string, ValorRow[]>()
  for (const row of historyRows) {
    if (row.empresa_cnpj.replace(/\D/g, '') !== digits) continue
    const key = competenciaKey(row.competencia)
    const list = byMonth.get(key) ?? []
    list.push(row)
    byMonth.set(key, list)
  }

  const months = [...byMonth.keys()].sort()
  const sliced = months.slice(-maxMonths)
  return sliced.map((key) => {
    const competencia = `${key}-01`
    const m = metricsForEmpresaMonth(byMonth.get(key) ?? [], digits, competencia)
    return {
      competencia,
      label: formatCompetencia(competencia),
      faturamento: m.faturamento ?? 0,
    }
  })
}
