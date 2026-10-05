import type { PerdcompPrazoSituacao } from '../../types'

const STYLES: Record<PerdcompPrazoSituacao, string> = {
  vencido: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  vence_7d: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  no_prazo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  sem_prazo: 'bg-slate-500/10 text-slate-500 dark:text-slate-400',
}

export function prazoLabel(
  situacao: PerdcompPrazoSituacao,
  dias: number | null,
): string {
  if (situacao === 'sem_prazo' || dias == null) return 'Sem prazo'
  if (situacao === 'vencido') {
    const n = Math.abs(dias)
    return `Vencido há ${n} ${n === 1 ? 'dia' : 'dias'}`
  }
  if (dias === 0) return 'Vence hoje'
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export default function PerdcompPrazoChip({
  situacao,
  dias,
}: {
  situacao: PerdcompPrazoSituacao
  dias: number | null
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLES[situacao]}`}
    >
      {prazoLabel(situacao, dias)}
    </span>
  )
}
