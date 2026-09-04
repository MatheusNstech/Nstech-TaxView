import type { Obrigacao } from '../types'

export type FechamentoStatus =
  | 'no_prazo'
  | 'fora_prazo'
  | 'aberto'
  | 'revisao'
  | 'atrasado'

export type FechamentoChip =
  | 'excecoes'
  | 'atrasadas'
  | 'vence_hoje'
  | 'fora_prazo'

export const FECHAMENTO_STATUS_ORDER: {
  key: FechamentoStatus
  label: string
  color: string
}[] = [
  { key: 'no_prazo', label: 'No prazo', color: '#00A76F' },
  { key: 'fora_prazo', label: 'Fora do prazo', color: '#FFAB00' },
  { key: 'aberto', label: 'Aberto no prazo', color: '#00B8D9' },
  { key: 'revisao', label: 'Em revisão', color: '#826AF9' },
  { key: 'atrasado', label: 'Atrasado', color: '#FF5630' },
]

export type FechamentoCounts = Record<FechamentoStatus, number> & {
  total: number
}

export interface FechamentoRow {
  nome: string
  no_prazo: number
  fora_prazo: number
  aberto: number
  revisao: number
  atrasado: number
  total: number
}

export interface FechamentoKpis {
  total: number
  percentualNoPrazo: number
  atrasadas: number
  venceHoje: number
  foraPrazo: number
}

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value || value.length < 10) return null
  return value.slice(0, 10)
}

function todayIso(today: Date): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function prazoFechamento(o: Obrigacao): string | null {
  return parseIsoDate(o.prazo_fiscal) ?? parseIsoDate(o.prazo_legal)
}

export function fechamentoStatus(o: Obrigacao, today: Date = new Date()): FechamentoStatus {
  const prazo = prazoFechamento(o)
  const entrega = parseIsoDate(o.data_entrega)
  const todayStr = todayIso(today)
  const aberto = o.status !== 'ENTREGUE'

  if (o.status === 'ENTREGUE') {
    if (entrega && prazo && entrega > prazo) return 'fora_prazo'
    return 'no_prazo'
  }

  if (o.status === 'ATRASADO') return 'atrasado'
  if (prazo && prazo < todayStr && aberto) return 'atrasado'
  if (o.status === 'EM_REVISAO') return 'revisao'
  return 'aberto'
}

export function isVencendoHoje(o: Obrigacao, today: Date = new Date()): boolean {
  if (o.status === 'ENTREGUE') return false
  const prazo = prazoFechamento(o)
  return prazo === todayIso(today)
}

export function fechamentoStatusLabel(status: FechamentoStatus): string {
  return FECHAMENTO_STATUS_ORDER.find((s) => s.key === status)?.label ?? status
}

export function isFechamentoExcecao(
  o: Obrigacao,
  today: Date = new Date(),
): boolean {
  const st = fechamentoStatus(o, today)
  return st === 'atrasado' || st === 'fora_prazo' || isVencendoHoje(o, today)
}

export function matchesFechamentoChip(
  o: Obrigacao,
  chip: FechamentoChip,
  today: Date = new Date(),
): boolean {
  if (chip === 'excecoes') return isFechamentoExcecao(o, today)
  if (chip === 'atrasadas') return fechamentoStatus(o, today) === 'atrasado'
  if (chip === 'vence_hoje') return isVencendoHoje(o, today)
  return fechamentoStatus(o, today) === 'fora_prazo'
}

export function sortFechamentoExcecoes(
  items: Obrigacao[],
  today: Date = new Date(),
): Obrigacao[] {
  const rank = (o: Obrigacao) => {
    const st = fechamentoStatus(o, today)
    if (st === 'atrasado') return 0
    if (isVencendoHoje(o, today)) return 1
    if (st === 'fora_prazo') return 2
    return 3
  }
  return [...items].sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d !== 0) return d
    const pa = prazoFechamento(a) ?? '9999-99-99'
    const pb = prazoFechamento(b) ?? '9999-99-99'
    return pa.localeCompare(pb)
  })
}

function emptyCounts(): FechamentoCounts {
  return {
    no_prazo: 0,
    fora_prazo: 0,
    aberto: 0,
    revisao: 0,
    atrasado: 0,
    total: 0,
  }
}

function bump(counts: FechamentoCounts, key: FechamentoStatus) {
  counts[key] += 1
  counts.total += 1
}

export function computeFechamentoKpis(
  obrigacoes: Obrigacao[],
  today: Date = new Date(),
): FechamentoKpis {
  const total = obrigacoes.length
  let noPrazo = 0
  let atrasadas = 0
  let venceHoje = 0
  let foraPrazo = 0
  for (const o of obrigacoes) {
    const st = fechamentoStatus(o, today)
    if (st === 'no_prazo') noPrazo += 1
    if (st === 'atrasado') atrasadas += 1
    if (st === 'fora_prazo') foraPrazo += 1
    if (isVencendoHoje(o, today)) venceHoje += 1
  }
  return {
    total,
    percentualNoPrazo: total ? Math.round((noPrazo / total) * 100) : 0,
    atrasadas,
    venceHoje,
    foraPrazo,
  }
}

function toRow(nome: string, counts: FechamentoCounts): FechamentoRow {
  return {
    nome,
    no_prazo: counts.no_prazo,
    fora_prazo: counts.fora_prazo,
    aberto: counts.aberto,
    revisao: counts.revisao,
    atrasado: counts.atrasado,
    total: counts.total,
  }
}

function gravity(row: FechamentoRow): number {
  return row.atrasado * 10 + row.fora_prazo * 4 + row.revisao * 2 + row.aberto
}

export function aggregateFechamentoByEmpresa(
  obrigacoes: Obrigacao[],
  today: Date = new Date(),
): FechamentoRow[] {
  const byName = new Map<string, FechamentoCounts>()
  for (const o of obrigacoes) {
    const nome = o.empresa?.razao_social?.trim() || 'Sem empresa'
    const bucket = byName.get(nome) ?? emptyCounts()
    bump(bucket, fechamentoStatus(o, today))
    byName.set(nome, bucket)
  }
  return Array.from(byName.entries())
    .map(([nome, counts]) => toRow(nome, counts))
    .sort(
      (a, b) =>
        gravity(b) - gravity(a) ||
        b.atrasado - a.atrasado ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
}

export function empresasComExcecao(
  obrigacoes: Obrigacao[],
  today: Date = new Date(),
  limit = 8,
): FechamentoRow[] {
  return aggregateFechamentoByEmpresa(obrigacoes, today)
    .filter((row) => row.atrasado > 0 || row.fora_prazo > 0)
    .slice(0, limit)
}

export function aggregateFechamentoByServico(
  obrigacoes: Obrigacao[],
  today: Date = new Date(),
): FechamentoRow[] {
  const byName = new Map<string, FechamentoCounts>()
  for (const o of obrigacoes) {
    const nome = o.atividade?.nome?.trim() || 'Sem tipo de serviço'
    const bucket = byName.get(nome) ?? emptyCounts()
    bump(bucket, fechamentoStatus(o, today))
    byName.set(nome, bucket)
  }
  return Array.from(byName.entries())
    .map(([nome, counts]) => toRow(nome, counts))
    .sort(
      (a, b) =>
        gravity(b) - gravity(a) ||
        b.total - a.total ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
}
