import { formatDate, isEntregue, isItemAtrasado } from '../lib/format'

export interface Sinais {
  atrasado: boolean
  reaberta: boolean
  tarefa: boolean
  /** Data da entrega anterior, para o tooltip de reaberta. */
  entregaOriginal?: string | null
}

export function sinaisDe(item: {
  status: string
  urgencia?: string | null
  entregaOriginal?: string | null
  origem?: 'obrigacao' | 'tarefa'
}): Sinais {
  return {
    atrasado: isItemAtrasado(item),
    reaberta: Boolean(item.entregaOriginal) && !isEntregue(item.status),
    tarefa: item.origem === 'tarefa',
    entregaOriginal: item.entregaOriginal,
  }
}

const SELO = 'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase'

export function Selos({ sinais, className = '' }: { sinais: Sinais; className?: string }) {
  if (!sinais.tarefa && !sinais.atrasado && !sinais.reaberta) return null
  return (
    <span className={`flex flex-wrap items-center justify-end gap-1 ${className}`}>
      {sinais.tarefa && <span className={`${SELO} bg-brand-500/15 text-brand-700 dark:text-brand-300`}>Tarefa</span>}
      {sinais.atrasado && (
        <span className={`${SELO} bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200`}>Atraso</span>
      )}
      {sinais.reaberta && (
        <span
          className={`${SELO} bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-200`}
          title={
            sinais.entregaOriginal
              ? `Entregue em ${formatDate(sinais.entregaOriginal.slice(0, 10))} e reaberta`
              : 'Reaberta'
          }
        >
          Reaberta
        </span>
      )}
    </span>
  )
}

export interface ContagemSinais {
  atrasadas?: number
  reabertas?: number
  tarefas?: number
}

/** Bolinhas para espaços pequenos (ex.: dia do calendário). */
export function Pontos({ contagem, className = '' }: { contagem: ContagemSinais; className?: string }) {
  const pontos: { cor: string; titulo: string }[] = []
  if (contagem.atrasadas) pontos.push({ cor: 'bg-rose-500', titulo: `${contagem.atrasadas} atrasado(s)` })
  if (contagem.reabertas) pontos.push({ cor: 'bg-violet-500', titulo: `${contagem.reabertas} reaberto(s)` })
  if (contagem.tarefas)
    pontos.push({ cor: 'bg-transparent ring-[1.5px] ring-inset ring-brand-500', titulo: `${contagem.tarefas} tarefa(s)` })
  if (pontos.length === 0) return null
  return (
    <span className={`flex items-center gap-0.5 ${className}`}>
      {pontos.map((p) => (
        <span key={p.titulo} title={p.titulo} className={`h-1.5 w-1.5 rounded-full ${p.cor}`} />
      ))}
    </span>
  )
}
