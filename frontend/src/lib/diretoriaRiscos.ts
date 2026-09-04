import type { DashboardSummary, Obrigacao } from '../types'

export type DiretoriaRiscoTipo = 'atrasado' | 'vence_7d' | 'sobrecarga'

export interface DiretoriaRisco {
  id: string
  tipo: DiretoriaRiscoTipo
  titulo: string
  detalhe: string
  obrigacao?: Obrigacao
  responsavelNome?: string
  /** Dias de atraso (positivo) ou dias até o prazo (negativo/zero para 7d). */
  diasRef?: number | null
  excesso?: number
}

export function daysUntil(
  iso: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  const t = new Date(today)
  t.setHours(12, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

function prazoRef(o: Obrigacao): string {
  return o.prazo_fiscal ?? o.prazo_legal ?? ''
}

/**
 * Lista completa de pendências críticas (sem slice).
 * Ordenada por severidade e urgência.
 */
export function buildDiretoriaRiscos(
  obrigacoes: Obrigacao[],
  summary: DashboardSummary | null,
  today: Date = new Date(),
): DiretoriaRisco[] {
  const risks: DiretoriaRisco[] = []

  const atrasados = obrigacoes
    .filter((o) => o.status === 'ATRASADO')
    .sort((a, b) => prazoRef(a).localeCompare(prazoRef(b)))

  for (const o of atrasados) {
    const days = daysUntil(prazoRef(o) || null, today)
    risks.push({
      id: `atr-${o.id}`,
      tipo: 'atrasado',
      titulo: o.atividade?.nome ?? 'Obrigação atrasada',
      detalhe: `${o.empresa?.razao_social ?? 'Empresa'} · ${o.responsavel?.nome ?? 'Sem responsável'} · ${o.empresa?.bu ?? '—'}`,
      obrigacao: o,
      diasRef: days != null ? Math.abs(Math.min(days, 0)) : null,
    })
  }

  const vence7 = obrigacoes
    .filter((o) => {
      if (o.status === 'ENTREGUE' || o.status === 'ATRASADO') return false
      const ref = o.prazo_fiscal ?? o.prazo_legal
      const days = daysUntil(ref, today)
      return days != null && days >= 0 && days <= 7
    })
    .sort((a, b) => prazoRef(a).localeCompare(prazoRef(b)))

  for (const o of vence7) {
    const days = daysUntil(prazoRef(o) || null, today)
    risks.push({
      id: `7d-${o.id}`,
      tipo: 'vence_7d',
      titulo: o.atividade?.nome ?? 'Vencimento em até 7 dias',
      detalhe: `${o.empresa?.razao_social ?? 'Empresa'} · ${o.responsavel?.nome ?? 'Sem responsável'} · ${o.empresa?.bu ?? '—'}`,
      obrigacao: o,
      diasRef: days,
    })
  }

  if (summary) {
    for (const [nome, total] of Object.entries(summary.por_responsavel)) {
      const cap = summary.capacidade_por_responsavel?.[nome]
      if (cap != null && total > cap) {
        risks.push({
          id: `cap-${nome}`,
          tipo: 'sobrecarga',
          titulo: `${nome} acima da capacidade`,
          detalhe: `${total} obrigações · capacidade ${cap} · excesso ${total - cap}`,
          responsavelNome: nome,
          excesso: total - cap,
        })
      }
    }
  }

  const rank = { atrasado: 0, vence_7d: 1, sobrecarga: 2 } as const
  return risks.sort((a, b) => {
    const byTipo = rank[a.tipo] - rank[b.tipo]
    if (byTipo !== 0) return byTipo
    if (a.tipo === 'sobrecarga') return (b.excesso ?? 0) - (a.excesso ?? 0)
    if (a.tipo === 'atrasado') return (b.diasRef ?? 0) - (a.diasRef ?? 0)
    return (a.diasRef ?? 99) - (b.diasRef ?? 99)
  })
}

export function countRiscosByTipo(riscos: DiretoriaRisco[]) {
  return {
    total: riscos.length,
    atrasado: riscos.filter((r) => r.tipo === 'atrasado').length,
    vence_7d: riscos.filter((r) => r.tipo === 'vence_7d').length,
    sobrecarga: riscos.filter((r) => r.tipo === 'sobrecarga').length,
  }
}
