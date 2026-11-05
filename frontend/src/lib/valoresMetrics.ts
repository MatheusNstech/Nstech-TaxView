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
  logo_url?: string | null
  logo_url_escuro?: string | null
  bu?: string | null
}

/** Cadastro TaxView — depara por CNPJ; o desktop pode seguir enviando o alias dele. */
export interface CadastroEmpresaRef {
  cnpj: string
  razao_social: string
  nome_fantasia?: string | null
  logo_url?: string | null
  logo_url_escuro?: string | null
  bu?: string | null
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

function cnpjDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function cnpjRaiz(digits: string): string {
  return digits.slice(0, 8)
}

function filialLabel(digits: string): string {
  if (digits.length < 14) return digits
  return `${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function groupEmpresas(rows: ValorRow[]): EmpresaOption[] {
  const map = new Map<string, EmpresaOption>()
  for (const row of rows) {
    const cnpj = cnpjDigits(row.empresa_cnpj)
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

/**
 * Troca alias/razão/logo do payload desktop pelos dados do cadastro (CNPJ).
 * Filial sem fantasia herda a da matriz e ganha sufixo 000X-XX.
 */
export function enrichEmpresasFromCadastro(
  options: EmpresaOption[],
  cadastro: CadastroEmpresaRef[],
): EmpresaOption[] {
  const byCnpj = new Map<string, CadastroEmpresaRef>()
  const fantasiaPorRaiz = new Map<string, string>()
  const logoPorRaiz = new Map<
    string,
    { logo_url?: string | null; logo_url_escuro?: string | null }
  >()

  for (const emp of cadastro) {
    const cnpj = cnpjDigits(emp.cnpj)
    if (!cnpj) continue
    byCnpj.set(cnpj, emp)
    const raiz = cnpjRaiz(cnpj)
    const fantasia = (emp.nome_fantasia || '').trim()
    if (fantasia) {
      const isMatriz = cnpj.length >= 12 && cnpj.slice(8, 12) === '0001'
      if (isMatriz || !fantasiaPorRaiz.has(raiz)) {
        fantasiaPorRaiz.set(raiz, fantasia)
      }
    }
    if (emp.logo_url || emp.logo_url_escuro) {
      const prev = logoPorRaiz.get(raiz)
      if (!prev?.logo_url || emp.logo_url) {
        logoPorRaiz.set(raiz, {
          logo_url: emp.logo_url ?? prev?.logo_url,
          logo_url_escuro: emp.logo_url_escuro ?? prev?.logo_url_escuro,
        })
      }
    }
  }

  return options
    .map((opt) => {
      const cad = byCnpj.get(opt.cnpj)
      if (!cad) return opt
      const raiz = cnpjRaiz(opt.cnpj)
      const ownFantasia = (cad.nome_fantasia || '').trim()
      const inherited = fantasiaPorRaiz.get(raiz) || ''
      const isMatriz = opt.cnpj.length >= 12 && opt.cnpj.slice(8, 12) === '0001'
      let alias = ownFantasia
      if (!alias && inherited && !isMatriz) {
        alias = `${inherited} · ${filialLabel(opt.cnpj)}`
      }
      if (!alias) alias = (cad.razao_social || '').trim() || opt.alias
      const logos = logoPorRaiz.get(raiz)
      return {
        ...opt,
        alias,
        razao: cad.razao_social || opt.razao,
        logo_url: cad.logo_url || logos?.logo_url || null,
        logo_url_escuro: cad.logo_url_escuro || logos?.logo_url_escuro || null,
        bu: cad.bu ?? null,
      }
    })
    .sort((a, b) => a.alias.localeCompare(b.alias, 'pt-BR'))
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
