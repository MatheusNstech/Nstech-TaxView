import {
  buildCheckpointHtml,
  checkpointFilename,
} from '../src/lib/checkpointHtml'
import type { WorkItem } from '../src/types'

const items: WorkItem[] = [
  {
    key: 'tarefa:1',
    origem: 'tarefa',
    id: '1',
    title: 'Adicionar Cruzamento Faturamento com Prefeituras',
    subtitle: 'Tarefa · Outras',
    responsavelNome: 'Matheus Silva Oliveira',
    solicitanteNome: 'Flavia',
    prazo: '2026-09-14',
    horaInicio: '09:00',
    horaFim: '18:00',
    status: 'EM_ANDAMENTO',
    urgencia: null,
    categoria: 'outras',
  },
  {
    key: 'tarefa:2',
    origem: 'tarefa',
    id: '2',
    title: 'Linha do Tempo Contencioso',
    subtitle: 'Tarefa · Outras',
    responsavelNome: 'Matheus Silva Oliveira',
    solicitanteNome: 'Glaucia',
    prazo: '2026-09-30',
    horaInicio: '10:00',
    horaFim: '12:00',
    status: 'PENDENTE',
    urgencia: null,
    categoria: 'outras',
  },
  {
    key: 'tarefa:3',
    origem: 'tarefa',
    id: '3',
    title: 'Macro Dashboard',
    subtitle: 'Tarefa · Outras',
    responsavelNome: 'Matheus Silva Oliveira',
    solicitanteNome: 'Checkpoint P6',
    prazo: '2026-09-09',
    horaInicio: '09:00',
    horaFim: '18:00',
    status: 'ENTREGUE',
    urgencia: null,
    categoria: 'outras',
  },
]

const html = buildCheckpointHtml({
  personName: 'Matheus Silva Oliveira',
  competenciaMonth: '2026-08',
  generatedAt: new Date(2026, 8, 14),
  items,
})
const name = checkpointFilename('Matheus Silva Oliveira', '2026-08')

const checks: [string, boolean][] = [
  ['filename', name === 'checkpoint-matheus-2026-08.html'],
  ['prazo 14/09', html.includes('14/09/2026')],
  ['prazo 30/09', html.includes('30/09/2026')],
  ['horario cruzamento', html.includes('09:00–18:00')],
  ['horario contencioso', html.includes('10:00–12:00')],
  ['person', html.includes('Matheus Silva Oliveira')],
  ['title', html.includes('Adicionar Cruzamento Faturamento com Prefeituras')],
  ['solicitante Flavia', html.includes('Flavia')],
  ['status EM ANDAMENTO', html.includes('EM ANDAMENTO')],
  ['status PENDENTE', html.includes('PENDENTE')],
  ['status ENTREGUE', html.includes('ENTREGUE')],
  ['no percent bars', !html.includes('progress-row') && !html.includes('bar-fill')],
  ['capa', html.includes('Checkpoint')],
  ['farol', html.includes('id="farol"')],
]

let failed = false
for (const [label, ok] of checks) {
  console.log(ok ? 'OK' : 'FAIL', label)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log('SMOKE_EXPORT_OK', html.length)
