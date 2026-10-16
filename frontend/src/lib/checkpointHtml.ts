import { formatDate, formatHorario, isEntregue } from './format'
import { tarefaCategoriaLabel } from '../types'
import type { StatusObrigacao, WorkItem } from '../types'

/** 'dev': quebra por solicitante e tipo, com horas, no lugar de BU/empresa. */
export type PerfilCheckpoint = 'padrao' | 'dev'

const LOGINS_DESENVOLVEDOR = ['matheus.silva-oliveira@nstech.com.br']

export function perfilCheckpointPorLogin(
  email: string | null | undefined,
): PerfilCheckpoint {
  return LOGINS_DESENVOLVEDOR.includes((email ?? '').trim().toLowerCase())
    ? 'dev'
    : 'padrao'
}

export interface CheckpointHtmlInput {
  personName: string
  competenciaMonth: string
  generatedAt: Date
  items: WorkItem[]
  perfil?: PerfilCheckpoint
}

/** Janela (dias) para considerar um item aberto como "vence em breve". */
const JANELA_RISCO_DIAS = 5

type Situacao =
  | 'atrasado'
  | 'risco'
  | 'andamento'
  | 'pendente'
  | 'entregue_prazo'
  | 'entregue_atraso'

interface Linha {
  item: WorkItem
  oQue: string
  empresa: string
  bu: string
  responsavel: string
  solicitante: string
  tipo: string
  /** Minutos planejados (hora_inicio → hora_fim). */
  minutos: number
  prazo: string | null
  entrega: string | null
  situacao: Situacao
  /** Dias de atraso (aberto: até hoje; entregue: até a entrega). */
  diasAtraso: number
  /** Dias até o prazo (só itens abertos dentro do prazo). */
  diasParaPrazo: number | null
  motivo: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0]
  return part || 'usuario'
}

function isoLocal(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatGeneratedDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(isoLocal(d))} às ${hh}:${mi}`
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function formatCompetenciaLabel(month: string): string {
  const [y, m] = month.split('-')
  const idx = Number(m) - 1
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return month
  return `${MESES[idx]}/${y}`
}

/** Diferença em dias corridos entre duas datas ISO (b - a). */
function diffDias(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  const ms = Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)
  return Math.round(ms / 86_400_000)
}

function dataEntrega(item: WorkItem): string | null {
  const raw =
    item.obrigacao?.data_entrega ??
    item.tarefa?.entregue_em ??
    item.entregaOriginal ??
    null
  return raw ? raw.slice(0, 10) : null
}

function nomeEmpresa(item: WorkItem): string {
  const e = item.obrigacao?.empresa ?? item.tarefa?.empresa
  return e?.nome_fantasia?.trim() || e?.razao_social?.trim() || '—'
}

function buEmpresa(item: WorkItem): string {
  const e = item.obrigacao?.empresa ?? item.tarefa?.empresa
  return e?.bu?.trim() || 'Sem BU'
}

function oQueDoItem(item: WorkItem): string {
  if (item.origem === 'obrigacao') {
    return item.obrigacao?.atividade?.nome?.trim() || item.subtitle || 'Obrigação'
  }
  return item.title
}

function minutosPlanejados(item: WorkItem): number {
  const toMin = (v: string | null | undefined) => {
    if (!v) return null
    const [h, m] = v.split(':').map(Number)
    return Number.isNaN(h) ? null : h * 60 + (m || 0)
  }
  const a = toMin(item.horaInicio)
  const b = toMin(item.horaFim)
  return a !== null && b !== null && b > a ? b - a : 0
}

function formatHoras(minutos: number): string {
  if (minutos <= 0) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function montarLinha(item: WorkItem, hoje: string): Linha {
  const prazo = item.prazo?.slice(0, 10) || null
  const entrega = dataEntrega(item)
  const motivo =
    (item.obrigacao?.motivo_atraso ?? item.tarefa?.motivo_atraso ?? '').trim()
  let situacao: Situacao
  let diasAtraso = 0
  let diasParaPrazo: number | null = null

  if (isEntregue(item.status)) {
    const atrasou = Boolean(prazo && entrega && entrega > prazo)
    situacao = atrasou ? 'entregue_atraso' : 'entregue_prazo'
    if (atrasou && prazo && entrega) diasAtraso = diffDias(prazo, entrega)
  } else if (
    item.status === 'ATRASADO' ||
    item.urgencia === 'atrasado' ||
    (prazo !== null && prazo < hoje)
  ) {
    situacao = 'atrasado'
    diasAtraso = prazo ? Math.max(0, diffDias(prazo, hoje)) : 0
  } else {
    diasParaPrazo = prazo ? diffDias(hoje, prazo) : null
    if (diasParaPrazo !== null && diasParaPrazo <= JANELA_RISCO_DIAS) {
      situacao = 'risco'
    } else if (item.status === 'EM_ANDAMENTO' || item.status === 'EM_REVISAO') {
      situacao = 'andamento'
    } else {
      situacao = 'pendente'
    }
  }

  return {
    item,
    oQue: oQueDoItem(item),
    empresa: nomeEmpresa(item),
    bu: buEmpresa(item),
    responsavel: item.responsavelNome?.trim() || '—',
    solicitante:
      item.solicitanteNome?.trim() ||
      item.tarefa?.solicitante_nome?.trim() ||
      (item.origem === 'obrigacao' ? 'Obrigação fiscal' : 'Sem solicitante'),
    tipo:
      item.obrigacao?.atividade?.nome?.trim() ||
      item.tarefa?.atividade?.nome?.trim() ||
      tarefaCategoriaLabel(item.categoria),
    minutos: minutosPlanejados(item),
    prazo,
    entrega,
    situacao,
    diasAtraso,
    diasParaPrazo,
    motivo,
  }
}

const STATUS_LABEL: Record<StatusObrigacao, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  EM_REVISAO: 'Em revisão',
  ENTREGA_PARCIAL: 'Entrega parcial',
  ENTREGUE: 'Entregue',
  ATRASADO: 'Atrasado',
}

function situacaoChip(l: Linha): string {
  switch (l.situacao) {
    case 'atrasado':
      return `<span class="chip c-late">Atrasado${l.diasAtraso ? ` · ${l.diasAtraso}d` : ''}</span>`
    case 'risco':
      return `<span class="chip c-warn">${
        l.diasParaPrazo === 0
          ? 'Vence hoje'
          : `Vence em ${l.diasParaPrazo}d`
      }</span>`
    case 'entregue_atraso':
      return `<span class="chip c-okl">Entregue c/ atraso · ${l.diasAtraso}d</span>`
    case 'entregue_prazo':
      return `<span class="chip c-ok">${escapeHtml(STATUS_LABEL[l.item.status])}</span>`
    case 'andamento':
      return `<span class="chip c-run">${escapeHtml(STATUS_LABEL[l.item.status])}</span>`
    default:
      return `<span class="chip c-plan">${escapeHtml(STATUS_LABEL[l.item.status])}</span>`
  }
}

const ORDEM_SITUACAO: Record<Situacao, number> = {
  atrasado: 0,
  risco: 1,
  andamento: 2,
  pendente: 3,
  entregue_atraso: 4,
  entregue_prazo: 5,
}

function porPrazo(a: Linha, b: Linha): number {
  return (a.prazo || '9999-99-99').localeCompare(b.prazo || '9999-99-99')
}

function porCriticidade(a: Linha, b: Linha): number {
  const s = ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
  if (s !== 0) return s
  if (a.situacao === 'atrasado') return b.diasAtraso - a.diasAtraso
  return porPrazo(a, b)
}

function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100)
}

interface Grupo {
  nome: string
  total: number
  entregues: number
  noPrazo: number
  atrasados: number
  risco: number
  minutos: number
}

function agrupar(linhas: Linha[], chave: (l: Linha) => string[]): Grupo[] {
  const map = new Map<string, Grupo>()
  for (const l of linhas) {
    for (const nome of chave(l)) {
      const g =
        map.get(nome) ??
        { nome, total: 0, entregues: 0, noPrazo: 0, atrasados: 0, risco: 0, minutos: 0 }
      g.total += 1
      g.minutos += l.minutos
      if (l.situacao === 'entregue_prazo' || l.situacao === 'entregue_atraso') {
        g.entregues += 1
      }
      if (l.situacao === 'entregue_prazo') g.noPrazo += 1
      if (l.situacao === 'atrasado') g.atrasados += 1
      if (l.situacao === 'risco') g.risco += 1
      map.set(nome, g)
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      b.atrasados - a.atrasados ||
      b.risco - a.risco ||
      pct(a.entregues, a.total) - pct(b.entregues, b.total) ||
      a.nome.localeCompare(b.nome),
  )
}

function tabelaGrupos(
  titulo: string,
  grupos: Grupo[],
  comHoras = false,
): string {
  const rows = grupos
    .map((g) => {
      const p = pct(g.entregues, g.total)
      return `<tr>
          <td class="strong">${escapeHtml(g.nome)}</td>
          <td class="num">${g.total}</td>
          <td class="num">${g.entregues}</td>
          <td class="num ${g.atrasados ? 'late' : 'zero'}">${g.atrasados}</td>
          <td class="num ${g.risco ? 'warn' : 'zero'}">${g.risco}</td>
          ${comHoras ? `<td class="num">${formatHoras(g.minutos)}</td>` : ''}
          <td class="bar-cell">
            <div class="mini"><span style="width:${p}%"></span></div>
            <b>${p}%</b>
          </td>
        </tr>`
    })
    .join('')
  return `<div class="card">
      <h3>${escapeHtml(titulo)}</h3>
      <table class="tbl">
        <thead><tr>
          <th>${escapeHtml(titulo.replace(/^Por /, ''))}</th>
          <th class="num">Itens</th>
          <th class="num">Entregues</th>
          <th class="num">Atrasados</th>
          <th class="num">Vencendo</th>
          ${comHoras ? '<th class="num">Horas</th>' : ''}
          <th>Conclusão</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

const EMBEDDED_CSS = `
:root {
  --laranja: #FF5B1F;
  --laranja-deep: #E84E14;
  --verde: #1F9D55;
  --verde-bg: #E7F6EE;
  --amarelo: #B7791F;
  --amarelo-bg: #FFF6E0;
  --vermelho: #D92D20;
  --vermelho-bg: #FEECEB;
  --azul: #3B4CCA;
  --azul-bg: #EEF1FF;
  --cinza: #E6E9EE;
  --muted: #667085;
  --fundo: #F5F6F8;
  --card: #FFFFFF;
  --texto: #101828;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: Montserrat, system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--fundo);
  color: var(--texto);
  line-height: 1.45;
  font-size: 14px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
header.top {
  background: var(--laranja);
  background-image: radial-gradient(circle at 92% -40%, rgba(255,255,255,.22) 0, transparent 55%),
    linear-gradient(120deg, var(--laranja) 0%, var(--laranja-deep) 100%);
  color: #fff;
  padding: 28px 0 84px;
}
.top-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.eyebrow { font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; opacity: .9; }
header h1 { font-size: clamp(1.6rem, 3.6vw, 2.3rem); font-weight: 800; letter-spacing: -.02em; margin-top: 6px; }
.who { margin-top: 6px; font-size: .95rem; font-weight: 500; opacity: .95; }
.brand { text-align: right; }
.brand .name { font-size: 1.3rem; font-weight: 800; letter-spacing: -.03em; }
.brand .tag { font-size: .58rem; letter-spacing: .12em; text-transform: uppercase; opacity: .85; }
.brand .gen { margin-top: 10px; font-size: .76rem; opacity: .9; }
main { margin-top: -60px; padding-bottom: 48px; display: flex; flex-direction: column; gap: 18px; }
.card {
  background: var(--card); border: 1px solid #EAECF0; border-radius: 14px;
  padding: 20px 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04);
}
h2 { font-size: .74rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin: 10px 0 -4px; }
h3 { font-size: .95rem; font-weight: 700; margin-bottom: 12px; }
h3 .count { color: var(--muted); font-weight: 600; }
.verdict { display: grid; grid-template-columns: auto 1fr auto; gap: 22px; align-items: center; }
.light {
  width: 64px; height: 64px; border-radius: 50%;
  display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 1.6rem;
}
.light.g { background: var(--verde); box-shadow: 0 0 0 8px var(--verde-bg); }
.light.y { background: #E0A100; box-shadow: 0 0 0 8px var(--amarelo-bg); }
.light.r { background: var(--vermelho); box-shadow: 0 0 0 8px var(--vermelho-bg); }
.verdict .tit { font-size: 1.15rem; font-weight: 800; }
.verdict .txt { color: #344054; margin-top: 4px; max-width: 640px; }
.ring { position: relative; width: 112px; height: 112px; }
.ring svg { transform: rotate(-90deg); }
.ring .lbl { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.ring .lbl b { font-size: 1.5rem; font-weight: 800; display: block; line-height: 1; }
.ring .lbl small { font-size: .66rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.kpi { background: var(--card); border: 1px solid #EAECF0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid var(--a, var(--laranja)); }
.kpi .k { font-size: .74rem; color: var(--muted); font-weight: 600; }
.kpi .v { font-size: 1.9rem; font-weight: 800; letter-spacing: -.03em; line-height: 1.15; margin-top: 2px; }
.kpi .s { font-size: .72rem; color: var(--muted); }
.stack { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: var(--cinza); margin-top: 16px; }
.stack span { display: block; height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: .74rem; color: var(--muted); }
.legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.tbl { width: 100%; border-collapse: collapse; font-size: .84rem; }
.tbl th {
  text-align: left; font-size: .66rem; text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted); font-weight: 700; padding: 0 10px 8px 0; border-bottom: 1px solid #EAECF0;
}
.tbl td { padding: 9px 10px 9px 0; border-bottom: 1px solid #F2F4F7; vertical-align: top; }
.tbl tr:last-child td { border-bottom: none; }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; }
.tbl .strong { font-weight: 600; }
.tbl .sub { display: block; color: var(--muted); font-size: .75rem; margin-top: 2px; }
.tbl td.late { color: var(--vermelho); font-weight: 700; }
.tbl td.warn { color: var(--amarelo); font-weight: 700; }
.tbl td.zero { color: #98A2B3; }
.bar-cell { white-space: nowrap; }
.bar-cell b { font-size: .78rem; margin-left: 8px; vertical-align: middle; }
.mini { display: inline-block; width: 90px; height: 6px; border-radius: 999px; background: var(--cinza); overflow: hidden; vertical-align: middle; }
.mini span { display: block; height: 100%; background: var(--verde); }
.chip { display: inline-block; font-size: .68rem; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
.c-ok { background: var(--verde-bg); color: var(--verde); }
.c-okl { background: #FFF1E8; color: #B54708; }
.c-run { background: var(--azul-bg); color: var(--azul); }
.c-plan { background: #F2F4F7; color: #475467; }
.c-warn { background: var(--amarelo-bg); color: var(--amarelo); }
.c-late { background: var(--vermelho-bg); color: var(--vermelho); }
.motivo { margin-top: 4px; font-size: .76rem; color: #475467; background: #F9FAFB; border-left: 3px solid #D0D5DD; padding: 4px 8px; border-radius: 0 6px 6px 0; }
.motivo.sem { color: var(--vermelho); border-left-color: var(--vermelho); background: var(--vermelho-bg); }
.empty { color: var(--muted); font-size: .86rem; padding: 6px 0; }
.empty.good { color: var(--verde); font-weight: 600; }
.full td:nth-child(1) { width: 34%; }
footer.foot { text-align: center; color: var(--muted); font-size: .72rem; padding: 8px 0 32px; }
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .two { grid-template-columns: 1fr; }
  .verdict { grid-template-columns: auto 1fr; }
  .verdict .ring { display: none; }
}
@media (max-width: 640px) {
  .wrap { padding: 0 16px; }
  .tbl-scroll { overflow-x: auto; }
  .brand { text-align: left; }
}
@media print {
  @page { size: A4; margin: 12mm; }
  body { background: #fff; font-size: 12px; }
  header.top { padding: 18px 0 64px; }
  .wrap { max-width: none; padding: 0; }
  .card, .kpi { box-shadow: none; break-inside: avoid; }
  .kpis { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
  .two { grid-template-columns: 1fr 1fr; }
  .tbl tr { break-inside: avoid; }
}
`

export function checkpointFilename(
  personName: string,
  competenciaMonth: string,
): string {
  const name = slugify(firstName(personName)) || 'usuario'
  const comp = competenciaMonth || 'competencia'
  return `checkpoint-${name}-${comp}.html`
}

export function buildCheckpointHtml(input: CheckpointHtmlInput): string {
  const person = input.personName.trim() || 'Responsável'
  const hoje = isoLocal(input.generatedAt)
  const linhas = input.items.map((i) => montarLinha(i, hoje))
  const total = linhas.length

  const conta = (s: Situacao) => linhas.filter((l) => l.situacao === s).length
  const atrasados = conta('atrasado')
  const risco = conta('risco')
  const noPrazo = conta('entregue_prazo')
  const comAtraso = conta('entregue_atraso')
  const entregues = noPrazo + comAtraso
  const andamento = conta('andamento')
  const pendentes = conta('pendente')
  const abertos = total - entregues
  const conclusao = pct(entregues, total)
  const pontualidade = pct(noPrazo, entregues)

  // Farol: vermelho com atraso em aberto; amarelo com prazo curto ou entrega atrasada.
  const farol: 'g' | 'y' | 'r' =
    atrasados > 0 ? 'r' : risco > 0 || comAtraso > 0 ? 'y' : 'g'
  const farolTitulo = {
    g: 'No prazo',
    y: 'Atenção',
    r: 'Crítico',
  }[farol]
  const farolSimbolo = { g: '✓', y: '!', r: '!' }[farol]

  const frases: string[] = [
    `${entregues} de ${total} ${total === 1 ? 'item concluído' : 'itens concluídos'} (${conclusao}%)`,
  ]
  if (entregues > 0) frases.push(`${pontualidade}% das entregas dentro do prazo`)
  if (atrasados > 0) {
    frases.push(
      `<b>${atrasados} ${atrasados === 1 ? 'item atrasado' : 'itens atrasados'} em aberto</b>`,
    )
  }
  if (risco > 0) {
    frases.push(
      `${risco} ${risco === 1 ? 'vence' : 'vencem'} nos próximos ${JANELA_RISCO_DIAS} dias`,
    )
  }
  if (abertos === 0 && total > 0) frases.push('competência sem pendências')
  const resumo = frases.join(' · ') + '.'

  const compLabel = formatCompetenciaLabel(input.competenciaMonth)
  const safePerson = escapeHtml(person)

  // Anel de conclusão.
  const R = 46
  const C = 2 * Math.PI * R
  const ring = `<div class="ring" aria-label="Conclusão ${conclusao}%">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r="${R}" fill="none" stroke="#EEF0F3" stroke-width="12"/>
        <circle cx="56" cy="56" r="${R}" fill="none" stroke="#FF5B1F" stroke-width="12"
          stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
          stroke-dashoffset="${(C * (1 - conclusao / 100)).toFixed(1)}"/>
      </svg>
      <div class="lbl"><div><b>${conclusao}%</b><small>Concluído</small></div></div>
    </div>`

  const stackParts: Array<[number, string, string]> = [
    [noPrazo, 'var(--verde)', 'Entregue no prazo'],
    [comAtraso, '#F79009', 'Entregue com atraso'],
    [andamento, 'var(--azul)', 'Em andamento'],
    [pendentes, '#98A2B3', 'Pendente'],
    [risco, '#FDB022', `Vence em até ${JANELA_RISCO_DIAS}d`],
    [atrasados, 'var(--vermelho)', 'Atrasado'],
  ]
  const stack = stackParts
    .filter(([n]) => n > 0)
    .map(
      ([n, cor, nome]) =>
        `<span style="width:${(n / Math.max(total, 1)) * 100}%;background:${cor}" title="${escapeHtml(nome)}: ${n}"></span>`,
    )
    .join('')
  const legend = stackParts
    .map(([n, cor, nome]) => `<span><i style="background:${cor}"></i>${escapeHtml(nome)} · ${n}</span>`)
    .join('')

  // Pontos de atenção: atrasados abertos e entregues fora do prazo.
  const atencao = linhas
    .filter((l) => l.situacao === 'atrasado' || l.situacao === 'entregue_atraso')
    .sort(porCriticidade)
  const atencaoRows = atencao
    .map((l) => {
      const motivo = l.motivo
        ? `<div class="motivo">Motivo: ${escapeHtml(l.motivo)}</div>`
        : l.situacao === 'atrasado'
          ? '<div class="motivo sem">Sem justificativa registrada</div>'
          : ''
      return `<tr>
          <td><span class="strong">${escapeHtml(l.oQue)}</span><span class="sub">${escapeHtml(l.empresa)}</span>${motivo}</td>
          <td>${escapeHtml(l.responsavel)}</td>
          <td class="num">${escapeHtml(formatDate(l.prazo))}</td>
          <td>${situacaoChip(l)}</td>
        </tr>`
    })
    .join('')

  // Próximos vencimentos (abertos, ainda no prazo).
  const proximos = linhas
    .filter((l) => l.situacao === 'risco' || l.situacao === 'andamento' || l.situacao === 'pendente')
    .sort(porPrazo)
    .slice(0, 8)
  const proximosRows = proximos
    .map(
      (l) => `<tr>
          <td><span class="strong">${escapeHtml(l.oQue)}</span><span class="sub">${escapeHtml(l.empresa)}</span></td>
          <td>${escapeHtml(l.responsavel)}</td>
          <td class="num">${escapeHtml(formatDate(l.prazo))}</td>
          <td>${situacaoChip(l)}</td>
        </tr>`,
    )
    .join('')

  const dev = input.perfil === 'dev'
  const porResp = agrupar(linhas, (l) =>
    l.responsavel === '—'
      ? ['Sem responsável']
      : l.responsavel.split(' / ').map((n) => n.trim()).filter(Boolean),
  )

  const blocosGrupo: string[] = []
  if (porResp.length > 1) blocosGrupo.push(tabelaGrupos('Por responsável', porResp))
  if (dev) {
    const porSolicitante = agrupar(linhas, (l) => [l.solicitante])
    const porTipo = agrupar(linhas, (l) => [l.tipo])
    blocosGrupo.push(tabelaGrupos('Por solicitante', porSolicitante, true))
    blocosGrupo.push(tabelaGrupos('Por tipo de atividade', porTipo, true))
  } else {
    const porBu = agrupar(linhas, (l) => [l.bu])
    const porEmpresa = agrupar(linhas, (l) => [l.empresa])
    if (porBu.length > 1) blocosGrupo.push(tabelaGrupos('Por BU', porBu))
    blocosGrupo.push(tabelaGrupos('Por empresa', porEmpresa.slice(0, 15)))
  }
  const minutosTotal = linhas.reduce((s, l) => s + l.minutos, 0)
  const minutosEntregues = linhas
    .filter((l) => l.situacao === 'entregue_prazo' || l.situacao === 'entregue_atraso')
    .reduce((s, l) => s + l.minutos, 0)
  const kpiHoras = dev
    ? `<div class="kpi" style="--a: var(--azul)"><div class="k">Horas planejadas</div><div class="v">${formatHoras(minutosTotal)}</div><div class="s">${formatHoras(minutosEntregues)} já entregues</div></div>`
    : ''

  const detalheRows = [...linhas]
    .sort(porCriticidade)
    .map((l) => {
      const horario = formatHorario(l.item.horaInicio, l.item.horaFim)
      return `<tr>
          <td><span class="strong">${escapeHtml(l.oQue)}</span><span class="sub">${escapeHtml(
            l.item.origem === 'obrigacao' ? 'Obrigação' : 'Tarefa',
          )}${horario ? ` · ${escapeHtml(horario)}` : ''}</span></td>
          <td>${escapeHtml(l.empresa)}</td>
          <td>${escapeHtml(l.responsavel)}</td>
          <td class="num">${escapeHtml(formatDate(l.prazo))}</td>
          <td class="num">${escapeHtml(l.entrega && isEntregue(l.item.status) ? formatDate(l.entrega) : '—')}</td>
          <td>${situacaoChip(l)}</td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Checkpoint · ${safePerson} · ${escapeHtml(compLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>${EMBEDDED_CSS}</style>
</head>
<body>
  <header class="top">
    <div class="wrap top-row">
      <div>
        <div class="eyebrow">Checkpoint · Competência ${escapeHtml(compLabel)}</div>
        <h1>Status das entregas</h1>
        <div class="who">${safePerson}</div>
      </div>
      <div class="brand">
        <div class="name">nstech</div>
        <div class="tag">Your Logistics Advantage</div>
        <div class="gen">Gerado em ${escapeHtml(formatGeneratedDate(input.generatedAt))}</div>
      </div>
    </div>
  </header>

  <main class="wrap">
    <section class="card verdict" aria-label="Resumo">
      <div class="light ${farol}" aria-hidden="true">${farolSimbolo}</div>
      <div>
        <div class="tit">Farol: ${farolTitulo}</div>
        <p class="txt">${resumo}</p>
      </div>
      ${ring}
    </section>

    <section class="kpis" aria-label="Indicadores">
      <div class="kpi" style="--a: var(--laranja)"><div class="k">Total de itens</div><div class="v">${total}</div><div class="s">${abertos} em aberto</div></div>
      <div class="kpi" style="--a: var(--verde)"><div class="k">Entregues</div><div class="v">${entregues}</div><div class="s">${conclusao}% do total</div></div>
      <div class="kpi" style="--a: #12B76A"><div class="k">Pontualidade</div><div class="v">${entregues ? `${pontualidade}%` : '—'}</div><div class="s">${noPrazo} no prazo · ${comAtraso} com atraso</div></div>
      <div class="kpi" style="--a: #FDB022"><div class="k">Vencem em ${JANELA_RISCO_DIAS} dias</div><div class="v">${risco}</div><div class="s">${andamento + pendentes} demais em aberto</div></div>
      <div class="kpi" style="--a: var(--vermelho)"><div class="k">Atrasados</div><div class="v">${atrasados}</div><div class="s">em aberto hoje</div></div>
      ${kpiHoras}
    </section>

    <section class="card" aria-label="Distribuição">
      <h3>Distribuição por situação</h3>
      <div class="stack">${stack}</div>
      <div class="legend">${legend}</div>
    </section>

    <h2>O que precisa de atenção</h2>
    <section class="two">
      <div class="card">
        <h3>Atrasos <span class="count">· ${atencao.length}</span></h3>
        ${
          atencao.length
            ? `<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th>Responsável</th><th class="num">Prazo</th><th>Situação</th></tr></thead><tbody>${atencaoRows}</tbody></table></div>`
            : '<p class="empty good">Nenhum atraso nesta competência.</p>'
        }
      </div>
      <div class="card">
        <h3>Próximos vencimentos <span class="count">· ${proximos.length}${abertos - atrasados > proximos.length ? ` de ${abertos - atrasados}` : ''}</span></h3>
        ${
          proximos.length
            ? `<div class="tbl-scroll"><table class="tbl"><thead><tr><th>Item</th><th>Responsável</th><th class="num">Prazo</th><th>Situação</th></tr></thead><tbody>${proximosRows}</tbody></table></div>`
            : '<p class="empty good">Nada em aberto dentro do prazo.</p>'
        }
      </div>
    </section>

    <h2>Visão consolidada</h2>
    ${blocosGrupo.map((b) => `<section class="tbl-scroll">${b}</section>`).join('\n')}

    <h2>Detalhamento completo</h2>
    <section class="card">
      <h3>Todos os itens <span class="count">· ${total}</span></h3>
      <div class="tbl-scroll">
        <table class="tbl full">
          <thead><tr>
            <th>Item</th><th>Empresa</th><th>Responsável</th>
            <th class="num">Prazo</th><th class="num">Entrega</th><th>Situação</th>
          </tr></thead>
          <tbody>${detalheRows || '<tr><td colspan="6" class="empty">Nenhum item</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </main>
  <footer class="foot">Situação calculada em ${escapeHtml(formatDate(hoje))}. "Vencem em ${JANELA_RISCO_DIAS} dias" considera itens em aberto com prazo até ${JANELA_RISCO_DIAS} dias corridos.</footer>
</body>
</html>`
}

export function downloadCheckpointHtml(
  html: string,
  filename: string,
): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
