import type { Obrigacao, Tarefa, WorkItem } from '../types'
import { tarefaCategoriaLabel } from '../types'

export function workItemFromObrigacao(o: Obrigacao): WorkItem {
  const categoria = o.categoria ?? 'fechamento'
  return {
    key: `obrigacao:${o.id}`,
    origem: 'obrigacao',
    id: o.id,
    title: o.empresa?.razao_social ?? 'Empresa',
    subtitle: o.atividade?.nome ?? '—',
    responsavelNome: o.responsavel?.nome ?? null,
    prazo: o.prazo_fiscal || o.prazo_legal,
    status: o.status,
    urgencia: o.urgencia,
    categoria,
    obrigacao: o,
  }
}

export function workItemFromTarefa(t: Tarefa): WorkItem {
  const catLabel = tarefaCategoriaLabel(t.categoria)
  return {
    key: `tarefa:${t.id}`,
    origem: 'tarefa',
    id: t.id,
    title: t.titulo,
    subtitle: t.empresa?.razao_social
      ? `${t.empresa.razao_social} · ${catLabel}`
      : `Tarefa · ${catLabel}`,
    responsavelNome: t.responsavel?.nome ?? null,
    prazo: t.prazo,
    horaInicio: t.hora_inicio,
    horaFim: t.hora_fim,
    status: t.status,
    urgencia: t.urgencia,
    categoria: t.categoria,
    tarefa: t,
  }
}


export function mergeWorkItems(
  obrigacoes: Obrigacao[],
  tarefas: Tarefa[],
): WorkItem[] {
  return [
    ...tarefas.map(workItemFromTarefa),
    ...obrigacoes.map(workItemFromObrigacao),
  ]
}
