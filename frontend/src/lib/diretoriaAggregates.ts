import type { Obrigacao, StatusObrigacao, WorkItem } from '../types'
import { tarefaCategoriaLabel } from '../types'

export const SERVICO_STATUS_ORDER: {
  key: StatusObrigacao
  label: string
  color: string
}[] = [
  { key: 'PENDENTE', label: 'Pendente', color: '#919EAB' },
  { key: 'EM_ANDAMENTO', label: 'Andamento', color: '#00B8D9' },
  { key: 'EM_REVISAO', label: 'Revisão', color: '#FFAB00' },
  { key: 'ENTREGUE', label: 'Entregue', color: '#00A76F' },
  { key: 'ATRASADO', label: 'Atrasado', color: '#FF5630' },
]

/** Paleta multi-cor para polar area (Minimals). */
export const DIRETORIA_POLAR_COLORS = [
  '#826AF9',
  '#00A76F',
  '#FF5630',
  '#00B8D9',
  '#FFAB00',
  '#3366FF',
  '#B76E00',
  '#22C55E',
  '#FF6C40',
  '#919EAB',
  '#7A0916',
]

export interface ServicoVolumeItem {
  nome: string
  total: number
}

export interface ServicoStatusRow {
  nome: string
  Pendente: number
  Andamento: number
  Revisão: number
  Entregue: number
  Atrasado: number
  total: number
}

const OUTROS = 'Outros'

function activityName(o: Obrigacao): string {
  return o.atividade?.nome?.trim() || 'Sem tipo de serviço'
}

/** Rótulo de serviço para obrigação ou tarefa manual. */
export function workItemServicoNome(item: WorkItem): string {
  if (item.origem === 'tarefa') {
    return `Tarefa · ${tarefaCategoriaLabel(item.categoria)}`
  }
  return item.obrigacao
    ? activityName(item.obrigacao)
    : item.subtitle || 'Sem tipo de serviço'
}

/**
 * Agrupa obrigações/tarefas por tipo de serviço.
 * Top `limit` por volume; restante consolida em "Outros".
 */
export function aggregateByServico(
  items: Obrigacao[] | WorkItem[],
  limit = 10,
): {
  volume: ServicoVolumeItem[]
  statusRows: ServicoStatusRow[]
} {
  const byName = new Map<
    string,
    { total: number; status: Partial<Record<StatusObrigacao, number>> }
  >()

  for (const raw of items) {
    const isWork = 'origem' in raw
    const nome = isWork
      ? workItemServicoNome(raw as WorkItem)
      : activityName(raw as Obrigacao)
    const status = (raw as Obrigacao | WorkItem).status
    const bucket = byName.get(nome) ?? { total: 0, status: {} }
    bucket.total += 1
    bucket.status[status] = (bucket.status[status] ?? 0) + 1
    byName.set(nome, bucket)
  }

  const ranked = Array.from(byName.entries()).sort(
    (a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], 'pt-BR'),
  )

  const top = ranked.slice(0, limit)
  const rest = ranked.slice(limit)

  const volume: ServicoVolumeItem[] = top.map(([nome, data]) => ({
    nome,
    total: data.total,
  }))

  const statusRows: ServicoStatusRow[] = top.map(([nome, data]) =>
    toStatusRow(nome, data.status, data.total),
  )

  if (rest.length > 0) {
    const outrosStatus: Partial<Record<StatusObrigacao, number>> = {}
    let outrosTotal = 0
    for (const [, data] of rest) {
      outrosTotal += data.total
      for (const [st, n] of Object.entries(data.status)) {
        const key = st as StatusObrigacao
        outrosStatus[key] = (outrosStatus[key] ?? 0) + (n ?? 0)
      }
    }
    volume.push({ nome: OUTROS, total: outrosTotal })
    statusRows.push(toStatusRow(OUTROS, outrosStatus, outrosTotal))
  }

  return { volume, statusRows }
}

function toStatusRow(
  nome: string,
  status: Partial<Record<StatusObrigacao, number>>,
  total: number,
): ServicoStatusRow {
  return {
    nome,
    Pendente: status.PENDENTE ?? 0,
    Andamento: status.EM_ANDAMENTO ?? 0,
    Revisão: status.EM_REVISAO ?? 0,
    Entregue: status.ENTREGUE ?? 0,
    Atrasado: status.ATRASADO ?? 0,
    total,
  }
}

export function isOutrosServico(nome: string): boolean {
  return nome === OUTROS
}
