import { formatDate, formatHorario, isEntregue } from './format'
import { tarefaCategoriaLabel } from '../types'
import type { StatusObrigacao, WorkItem } from '../types'

/** 'dev': gráficos por solicitante e por tipo no lugar de BU/empresa. */
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
  /** Foto (data URL) por nome do responsável; sem foto, usa as iniciais. */
  fotos?: Record<string, string>
}

/** Janela (dias) para considerar um item aberto como "vence em breve". */
const JANELA_RISCO_DIAS = 3

type Situacao =
  | 'atrasado'
  | 'risco'
  | 'andamento'
  | 'pendente'
  | 'entregue_prazo'
  | 'entregue_atraso'

/** Filtro da tabela de detalhamento (data-grupo da linha). */
type GrupoFiltro = 'atrasado' | 'risco' | 'aberto' | 'entregue'

interface Linha {
  item: WorkItem
  oQue: string
  descricao: string
  empresa: string
  bu: string
  responsavel: string
  solicitante: string
  tipo: string
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

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios
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
    descricao: (
      item.tarefa?.descricao ??
      item.obrigacao?.observacao ??
      ''
    ).trim(),
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
    prazo,
    entrega,
    situacao,
    diasAtraso,
    diasParaPrazo,
    motivo,
  }
}

function grupoFiltro(l: Linha): GrupoFiltro {
  if (l.situacao === 'atrasado') return 'atrasado'
  if (l.situacao === 'risco') return 'risco'
  if (l.situacao === 'entregue_prazo' || l.situacao === 'entregue_atraso') {
    return 'entregue'
  }
  return 'aberto'
}

const STATUS_LABEL: Record<StatusObrigacao, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  EM_REVISAO: 'Em revisão',
  ENTREGA_PARCIAL: 'Entrega parcial',
  ENTREGUE: 'Entregue',
  ATRASADO: 'Atrasado',
}

/** Mesmas cores do StatusBadge do sistema. */
const STATUS_TOM: Record<StatusObrigacao, string> = {
  PENDENTE: 't-slate',
  EM_ANDAMENTO: 't-sky',
  EM_REVISAO: 't-amber',
  ENTREGA_PARCIAL: 't-teal',
  ENTREGUE: 't-emerald',
  ATRASADO: 't-rose',
}

function textoDias(n: number): string {
  return `${n} ${plural(n, 'dia', 'dias')}`
}

function situacaoBadge(l: Linha): string {
  const badge = (tom: string, texto: string) =>
    `<span class="badge ${tom}">${escapeHtml(texto)}</span>`
  switch (l.situacao) {
    case 'atrasado':
      return badge(
        't-rose',
        l.diasAtraso ? `Atrasado há ${textoDias(l.diasAtraso)}` : 'Atrasado',
      )
    case 'risco':
      return badge(
        't-brand',
        l.diasParaPrazo === 0
          ? 'Vence hoje'
          : l.diasParaPrazo === 1
            ? 'Vence amanhã'
            : `Vence em ${textoDias(l.diasParaPrazo ?? 0)}`,
      )
    case 'entregue_atraso':
      return `${badge(STATUS_TOM[l.item.status], STATUS_LABEL[l.item.status])}<span class="badge-note">${escapeHtml(textoDias(l.diasAtraso))} após o prazo</span>`
    default:
      return badge(STATUS_TOM[l.item.status], STATUS_LABEL[l.item.status])
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

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function nomeCurto(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : nome.trim()
}

/** Fotos do relatório em montagem (buildCheckpointHtml é síncrono). */
let fotosAtuais: Record<string, string> = {}

function avatar(nome: string, classe = ''): string {
  const foto = fotosAtuais[nome.trim()]
  return foto
    ? `<span class="avatar ${classe}"><img src="${foto}" alt="" /></span>`
    : `<span class="avatar ${classe}">${escapeHtml(iniciais(nomeCurto(nome)))}</span>`
}

function pessoa(nome: string): string {
  if (!nome || nome === '—') return '<span class="muted">—</span>'
  const nomes = nome.split(' / ').map((n) => n.trim()).filter(Boolean)
  const primeiro = nomes[0] ?? nome
  const extra = nomes.length > 1 ? ` <span class="muted">+${nomes.length - 1}</span>` : ''
  return `<span class="person" title="${escapeHtml(nomes.join(', '))}">${avatar(
    primeiro,
  )}<span class="person-name">${escapeHtml(nomeCurto(primeiro))}</span>${extra}</span>`
}

/** Baixa as fotos e reduz para 176px, para o HTML funcionar offline. */
export async function carregarFotosCheckpoint(
  pessoas: Array<{ nome: string; url: string | null }>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(
    pessoas.map(async ({ nome, url }) => {
      const chave = nome.trim()
      if (!chave || !url || out[chave]) return
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const bmp = await createImageBitmap(await res.blob())
        const lado = Math.min(bmp.width, bmp.height)
        const sx = (bmp.width - lado) / 2
        // Mesmo enquadramento do PersonAvatar (object-position: center 20%).
        const sy = (bmp.height - lado) * 0.2
        const canvas = document.createElement('canvas')
        canvas.width = 176
        canvas.height = 176
        canvas.getContext('2d')?.drawImage(bmp, sx, sy, lado, lado, 0, 0, 176, 176)
        out[chave] = canvas.toDataURL('image/jpeg', 0.85)
      } catch {
        // Sem foto: o relatório usa as iniciais.
      }
    }),
  )
  return out
}

/** Ícones no traço do lucide-react (o mesmo do sistema). */
const ICON: Record<string, string> = {
  layers:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  check:
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calendar:
    '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  octagon:
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.31 2a2 2 0 0 1 1.42.59l4.68 4.68A2 2 0 0 1 22 8.69v6.62a2 2 0 0 1-.59 1.42l-4.68 4.68a2 2 0 0 1-1.42.59H8.69a2 2 0 0 1-1.42-.59l-4.68-4.68A2 2 0 0 1 2 15.31V8.69a2 2 0 0 1 .59-1.42l4.68-4.68A2 2 0 0 1 8.69 2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
}

function icon(nome: keyof typeof ICON, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[nome]}</svg>`
}

interface Grupo {
  nome: string
  total: number
  entregues: number
  noPrazo: number
  atrasados: number
  risco: number
}

function agrupar(linhas: Linha[], chave: (l: Linha) => string[]): Grupo[] {
  const map = new Map<string, Grupo>()
  for (const l of linhas) {
    for (const nome of chave(l)) {
      const g =
        map.get(nome) ??
        { nome, total: 0, entregues: 0, noPrazo: 0, atrasados: 0, risco: 0 }
      g.total += 1
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

function cardHead(titulo: string, sub: string, count?: number): string {
  return `<header class="card-head">
      <div>
        <h2>${escapeHtml(titulo)}${
          count !== undefined ? ` <span class="count">${count}</span>` : ''
        }</h2>
        <p class="card-sub">${escapeHtml(sub)}</p>
      </div>
    </header>`
}

function tabelaGrupos(opts: {
  titulo: string
  sub: string
  coluna: string
  grupos: Grupo[]
  comPessoa?: boolean
}): string {
  const { grupos, comPessoa } = opts
  const rows = grupos
    .map((g) => {
      const p = pct(g.entregues, g.total)
      return `<tr>
          <td>${comPessoa ? pessoa(g.nome) : `<span class="strong">${escapeHtml(g.nome)}</span>`}</td>
          <td class="num">${g.total}</td>
          <td class="num ${g.atrasados ? 'n-rose' : 'n-zero'}">${g.atrasados}</td>
          <td class="num ${g.risco ? 'n-brand' : 'n-zero'}">${g.risco}</td>
          <td class="progress-cell">
            <span class="meter"><span style="width:${p}%"></span></span>
            <span class="meter-v">${p}%</span>
            <span class="meter-sub">${g.entregues} de ${g.total}</span>
          </td>
        </tr>`
    })
    .join('')
  return `<section class="card">
      ${cardHead(opts.titulo, opts.sub, grupos.length)}
      <div class="tbl-wrap" style="--h: 320px">
        <table class="tbl compact">
          <thead><tr>
            <th>${escapeHtml(opts.coluna)}</th>
            <th class="num">Itens</th>
            <th class="num">Atrasados</th>
            <th class="num">Vencendo</th>
            <th>Entregues</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`
}

/** Paleta validada (CVD e contraste) para as barras por situação. */
const COR_BARRA = {
  entregue: '#059669',
  aberto: '#0284c7',
  risco: '#ea580c',
  atrasado: '#be123c',
}

/** Barras horizontais empilhadas por situação, uma linha por grupo. */
function graficoGrupos(opts: { titulo: string; sub: string; grupos: Grupo[] }): string {
  const grupos = [...opts.grupos].sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome),
  )
  const max = Math.max(1, ...grupos.map((g) => g.total))
  const soma = (k: 'entregues' | 'atrasados' | 'risco') =>
    grupos.reduce((s, g) => s + g[k], 0)
  const abertoDe = (g: Grupo) => g.total - g.entregues - g.atrasados - g.risco
  const legenda: Array<[string, string, number]> = [
    ['Entregue', COR_BARRA.entregue, soma('entregues')],
    ['Em aberto', COR_BARRA.aberto, grupos.reduce((s, g) => s + abertoDe(g), 0)],
    [`Vence em até ${JANELA_RISCO_DIAS} dias`, COR_BARRA.risco, soma('risco')],
    ['Atrasado', COR_BARRA.atrasado, soma('atrasados')],
  ]
  const rows = grupos
    .map((g) => {
      const partes: Array<[number, string, string]> = [
        [g.entregues, COR_BARRA.entregue, 'Entregue'],
        [abertoDe(g), COR_BARRA.aberto, 'Em aberto'],
        [g.risco, COR_BARRA.risco, 'Vencendo'],
        [g.atrasados, COR_BARRA.atrasado, 'Atrasado'],
      ]
      const detalhe = partes
        .filter(([n]) => n > 0)
        .map(([n, , nome]) => `${nome}: ${n}`)
        .join(' · ')
      const segs = partes
        .filter(([n]) => n > 0)
        .map(([n, cor]) => `<span style="flex:${n};background:${cor}"></span>`)
        .join('')
      return `<div class="hbar-row" title="${escapeHtml(`${g.nome} — ${detalhe}`)}">
          <span class="hbar-label">${escapeHtml(g.nome)}</span>
          <span class="hbar-track"><span class="hbar" style="width:${(g.total / max) * 100}%">${segs}</span></span>
          <span class="hbar-value"><b>${g.total}</b> ${plural(g.total, 'item', 'itens')}</span>
        </div>`
    })
    .join('')
  return `<section class="card">
      ${cardHead(opts.titulo, opts.sub, grupos.length)}
      <div class="hbar-legend">${legenda
        .map(([nome, cor, n]) => `<span><i style="background:${cor}"></i>${escapeHtml(nome)} <b>${n}</b></span>`)
        .join('')}</div>
      <div class="hbar-list">${rows}</div>
    </section>`
}

/** Ordem categórica fixa (paleta de referência validada). */
const CORES_CATEGORIA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
const COR_OUTROS = '#94a3b8'

/** Rosca com a fatia de itens de cada grupo; acima de 6 grupos, junta em "Outros". */
function graficoRosca(opts: { titulo: string; sub: string; grupos: Grupo[] }): string {
  const grupos = [...opts.grupos].sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome),
  )
  const total = grupos.reduce((s, g) => s + g.total, 0)
  const head = cardHead(opts.titulo, opts.sub, grupos.length)
  if (total === 0) {
    return `<section class="card">${head}<div class="empty"><b>Nenhum item</b>Não há itens com os filtros usados.</div></section>`
  }
  const fatias: Array<{ nome: string; n: number; cor: string }> = grupos
    .slice(0, CORES_CATEGORIA.length)
    .map((g, i) => ({ nome: g.nome, n: g.total, cor: CORES_CATEGORIA[i] }))
  const resto = grupos.slice(CORES_CATEGORIA.length)
  if (resto.length) {
    fatias.push({
      nome: `Outros (${resto.length})`,
      n: resto.reduce((s, g) => s + g.total, 0),
      cor: COR_OUTROS,
    })
  }
  const itens = (n: number) => `${n} ${plural(n, 'item', 'itens')}`

  const R = 70
  const C = 2 * Math.PI * R
  // 2px de respiro entre as fatias (só com mais de uma).
  const gap = fatias.length > 1 ? 2 : 0
  let acumulado = 0
  const arcos = fatias
    .map((f) => {
      const len = (f.n / total) * C
      const arco = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${f.cor}" stroke-width="26"
          stroke-dasharray="${Math.max(0, len - gap).toFixed(2)} ${(C - Math.max(0, len - gap)).toFixed(2)}"
          stroke-dashoffset="${(-acumulado).toFixed(2)}"><title>${escapeHtml(
            `${f.nome}: ${itens(f.n)} (${pct(f.n, total)}%)`,
          )}</title></circle>`
      acumulado += len
      return arco
    })
    .join('')
  const legenda = fatias
    .map(
      (f) => `<li>
          <i style="background:${f.cor}"></i>
          <span class="pie-name">${escapeHtml(f.nome)}</span>
          <span class="pie-val"><b>${itens(f.n)}</b> · ${pct(f.n, total)}%</span>
        </li>`,
    )
    .join('')
  return `<section class="card">
      ${head}
      <div class="pie">
        <div class="pie-chart">
          <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="${escapeHtml(opts.titulo)}">
            <g transform="rotate(-90 90 90)">
              <circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--line-soft)" stroke-width="26" />
              ${arcos}
            </g>
          </svg>
          <div class="pie-center"><b>${total}</b><span>${plural(total, 'item', 'itens')}</span></div>
        </div>
        <ul class="pie-legend">${legenda}</ul>
      </div>
    </section>`
}

const EMBEDDED_CSS = `
:root {
  color-scheme: light;
  --brand: #ff3d03;
  --brand-400: #ff6233;
  --brand-600: #e63600;
  --brand-700: #c22e00;
  --brand-soft: rgb(255 61 3 / 0.12);
  --ink: #212b36;
  --muted: #637381;
  --line: #e5e7eb;
  --line-soft: #f1f3f5;
  --surface: #f4f6f8;
  --panel: #ffffff;
  --panel-head: #fafbfc;
  --glass-bg: rgb(255 255 255 / 0.72);
  --glass-border: rgb(255 255 255 / 0.8);
  --glass-inset: rgb(255 255 255 / 0.7);
  --glass-shadow: rgb(33 43 54 / 0.12);
  --mesh-g1: rgb(255 61 3 / 0.14);
  --mesh-g2: rgb(255 98 51 / 0.12);
  --mesh-g3: rgb(255 228 219 / 0.55);
  --mesh-top: #ffffff;
  --mesh-bot: #fff4f0;
  --row-hover: rgb(255 61 3 / 0.05);
  --slate-bg: #f1f5f9; --slate-fg: #334155; --slate-ring: #e2e8f0;
  --sky-bg: #f0f9ff; --sky-fg: #0369a1; --sky-ring: #bae6fd;
  --amber-bg: #fffbeb; --amber-fg: #92400e; --amber-ring: #fde68a;
  --teal-bg: #f0fdfa; --teal-fg: #0f766e; --teal-ring: #99f6e4;
  --emerald-bg: #ecfdf5; --emerald-fg: #047857; --emerald-ring: #a7f3d0;
  --rose-bg: #fff1f2; --rose-fg: #be123c; --rose-ring: #fecdd3;
  --brand-bg: #fff4f0; --brand-fg: #c22e00; --brand-ring: #ffc4b3;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink);
  min-height: 100vh;
  background-color: var(--surface);
  background-image:
    radial-gradient(ellipse 80% 50% at 10% -10%, var(--mesh-g1), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, var(--mesh-g2), transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 100%, var(--mesh-g3), transparent 55%),
    linear-gradient(180deg, var(--mesh-top) 0%, var(--surface) 45%, var(--mesh-bot) 100%);
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page { max-width: 1240px; margin: 0 auto; padding: 32px 24px 48px; display: flex; flex-direction: column; gap: 24px; }
.muted { color: var(--muted); }
.strong { font-weight: 600; }

/* Cabeçalho, como o topo das páginas do sistema */
.page-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 16px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 999px; border: 1px solid var(--glass-border);
  background: var(--glass-bg); padding: 4px 12px;
  font-size: 12px; font-weight: 600; color: var(--ink);
  box-shadow: 0 1px 0 var(--glass-inset) inset;
}
.chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); }
.page-head h1 { margin-top: 10px; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
.page-head .lead { margin-top: 4px; color: var(--muted); }
.wordmark { font-size: 22px; font-weight: 700; letter-spacing: -0.04em; color: var(--brand); text-align: right; }
.wordmark small { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }

/* Superfícies */
.glass {
  border-radius: 20px; border: 1px solid var(--glass-border); background: var(--glass-bg);
  box-shadow: 0 1px 0 var(--glass-inset) inset, 0 8px 32px -12px var(--glass-shadow);
  backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5);
}
.card {
  border-radius: 20px; background: var(--panel); overflow: hidden;
  box-shadow: 0 0 2px rgb(145 158 171 / 0.2), 0 12px 24px -4px rgb(145 158 171 / 0.12);
  display: flex; flex-direction: column; min-width: 0;
}
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 20px 20px 14px; }
.card-head h2 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }
.count {
  display: inline-flex; min-width: 22px; height: 22px; padding: 0 7px; align-items: center; justify-content: center;
  border-radius: 999px; background: var(--line-soft); color: var(--muted); font-size: 12px; font-weight: 600;
}
.card-sub { margin-top: 2px; font-size: 12px; color: var(--muted); }

/* Resumo */
.verdict { display: grid; grid-template-columns: auto 1fr minmax(200px, 260px); gap: 20px; align-items: center; padding: 20px 24px; }
.icon-box { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; }
.ib-emerald { background: rgb(16 185 129 / 0.15); color: #047857; }
.ib-amber { background: rgb(245 158 11 / 0.18); color: #b45309; }
.ib-rose { background: rgb(244 63 94 / 0.15); color: #be123c; }
.ib-brand { background: var(--brand-soft); color: var(--brand-600); }
.ib-sky { background: rgb(14 165 233 / 0.15); color: #0369a1; }
.verdict .eyebrow { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.verdict .title { margin-top: 2px; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
.verdict .text { margin-top: 4px; color: var(--muted); max-width: 680px; }
.verdict .text b { color: var(--ink); font-weight: 600; }
.goal .row { display: flex; justify-content: space-between; align-items: baseline; }
.goal .row span { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.goal .row b { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
.bar { margin-top: 8px; height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; }
.bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--brand-400), var(--brand)); }
.goal small { display: block; margin-top: 6px; font-size: 12px; color: var(--muted); }

/* KPIs, como o AnalyticsHeroKpis */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.kpi { padding: 20px; }
.kpi .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.kpi .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.kpi .value { margin-top: 8px; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.kpi .hint { margin-top: 6px; font-size: 12px; color: var(--muted); }
.kpi .icon-box { width: 40px; height: 40px; }
.v-emerald { color: #047857; } .v-rose { color: #be123c; } .v-brand { color: var(--brand-700); } .v-sky { color: #0369a1; }

/* Distribuição */
.dist { padding: 0 20px 20px; }
.stack { display: flex; gap: 2px; height: 10px; border-radius: 999px; overflow: hidden; background: var(--line); }
.stack span { display: block; height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 14px; font-size: 12px; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 8px; height: 8px; border-radius: 50%; }
.legend b { color: var(--ink); font-weight: 600; }

.grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 520px), 1fr)); gap: 24px; align-items: stretch; }
.grid-2 > .card:last-child:nth-child(odd) { grid-column: 1 / -1; }
.grid-2 > .card > .tbl-wrap, .grid-2 > .card > .hbar-list, .grid-2 > .card > .pie, .grid-2 > .card > .empty { flex: 1 1 auto; }
.grid-2 > .card > .empty { display: grid; place-content: center; }
.section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 8px 0 -8px; }

/* Tabelas com rolagem e cabeçalho fixo */
.tbl-wrap { max-height: var(--h, 360px); overflow: auto; border-top: 1px solid var(--line); scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.tbl-wrap::-webkit-scrollbar { width: 8px; height: 8px; }
.tbl-wrap::-webkit-scrollbar-thumb { background: var(--line); border-radius: 999px; }
.tbl { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.tbl.wide { min-width: 760px; }
.tbl th {
  position: sticky; top: 0; z-index: 1; background: var(--panel-head);
  text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); white-space: nowrap;
}
.tbl td { padding: 12px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
.tbl tbody tr:hover td { background: var(--row-hover); }
.tbl tbody tr:last-child td { border-bottom: none; }
.tbl th:first-child, .tbl td:first-child { padding-left: 20px; }
.tbl th:last-child, .tbl td:last-child { padding-right: 20px; }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl .date { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
.n-rose { color: #be123c; font-weight: 700; } .n-brand { color: var(--brand-700); font-weight: 700; } .n-zero { color: var(--muted); opacity: 0.6; }
.item-title { font-weight: 600; color: var(--ink); line-height: 1.4; }
.tbl.fixed { table-layout: fixed; }
.tbl.fixed td { overflow-wrap: anywhere; }
.row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 6px; }
.row-meta .person { gap: 6px; }
.row-meta .avatar { width: 30px; height: 30px; font-size: 11px; }
.row-meta { margin-top: 8px; }
.row-meta .person-name { font-weight: 500; color: var(--ink); }
.row-meta .sep { color: var(--line); }
.tbl-wrap:not(.x) { overflow-x: hidden; }
.item-meta { margin-top: 2px; font-size: 12px; color: var(--muted); }
.desc {
  margin-top: 6px; font-size: 12.5px; color: var(--muted); line-height: 1.5; max-width: 520px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  cursor: pointer; white-space: pre-line;
}
.desc.open { -webkit-line-clamp: unset; display: block; }
.note { margin-top: 10px; line-height: 1.45; font-size: 12px; padding: 6px 10px; border-radius: 10px; background: var(--line-soft); color: var(--ink); }
.note b { font-weight: 600; color: var(--muted); }
.note.missing { background: var(--rose-bg); color: var(--rose-fg); }

/* Status, como o StatusBadge */
.badge {
  display: inline-flex; align-items: center; white-space: nowrap; border-radius: 999px; padding: 2px 10px;
  font-size: 12px; font-weight: 500; box-shadow: inset 0 0 0 1px var(--r);
  background: var(--b); color: var(--f);
}
.badge-note { display: block; margin-top: 4px; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.t-slate { --b: var(--slate-bg); --f: var(--slate-fg); --r: var(--slate-ring); }
.t-sky { --b: var(--sky-bg); --f: var(--sky-fg); --r: var(--sky-ring); }
.t-amber { --b: var(--amber-bg); --f: var(--amber-fg); --r: var(--amber-ring); }
.t-teal { --b: var(--teal-bg); --f: var(--teal-fg); --r: var(--teal-ring); }
.t-emerald { --b: var(--emerald-bg); --f: var(--emerald-fg); --r: var(--emerald-ring); }
.t-rose { --b: var(--rose-bg); --f: var(--rose-fg); --r: var(--rose-ring); }
.t-brand { --b: var(--brand-bg); --f: var(--brand-fg); --r: var(--brand-ring); }

.person { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.avatar {
  display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: var(--brand-soft); color: var(--brand-700); font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
  overflow: hidden; box-shadow: 0 0 0 1px rgb(145 158 171 / 0.25);
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.head-main { display: flex; align-items: center; gap: 18px; min-width: 0; }
.head-people { display: flex; flex-shrink: 0; }
.head-people .avatar { width: 88px; height: 88px; font-size: 26px; box-shadow: 0 0 0 3px #fff, 0 8px 20px -8px rgb(33 43 54 / 0.35); }
.head-people .avatar + .avatar { margin-left: -18px; }
.head-people.many .avatar { width: 60px; height: 60px; font-size: 18px; }
.head-people.many .avatar + .avatar { margin-left: -12px; }
.head-people .more { background: var(--line-soft); color: var(--muted); }
.person-name { font-weight: 500; }

.progress-cell { white-space: nowrap; }
.meter { display: inline-block; width: 72px; height: 6px; border-radius: 999px; background: var(--line); overflow: hidden; vertical-align: middle; }
.meter span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--brand-400), var(--brand)); }
.tbl.compact th, .tbl.compact td { padding-left: 10px; padding-right: 10px; }
.tbl.compact td:first-child { min-width: 140px; }
.meter-sub { display: block; margin-top: 2px; font-size: 11.5px; color: var(--muted); }
.meter-v { display: inline-block; width: 40px; text-align: right; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; vertical-align: middle; }

.hbar-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 0 20px 12px; font-size: 12px; color: var(--muted); }
.hbar-legend span { display: inline-flex; align-items: center; gap: 6px; }
.hbar-legend i { width: 8px; height: 8px; border-radius: 2px; }
.hbar-legend b { color: var(--ink); font-weight: 600; }
.hbar-list { max-height: 340px; overflow-y: auto; border-top: 1px solid var(--line); padding: 8px 0; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.hbar-row { display: grid; grid-template-columns: minmax(90px, 160px) 1fr auto; align-items: center; gap: 14px; padding: 7px 20px; }
.hbar-row:hover { background: var(--row-hover); }
.hbar-label { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hbar-track { display: block; min-width: 0; }
.hbar { display: flex; gap: 2px; height: 12px; min-width: 6px; }
.hbar span { display: block; height: 100%; }
.hbar span:first-child { border-radius: 4px 0 0 4px; }
.hbar span:last-child { border-radius: 0 4px 4px 0; }
.hbar span:only-child { border-radius: 4px; }
.hbar-value { font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; min-width: 92px; }
.hbar-value b { font-weight: 600; }
.pie { display: flex; align-items: center; gap: 28px; padding: 8px 24px 24px; flex-wrap: wrap; }
.pie-chart { position: relative; width: 180px; height: 180px; flex-shrink: 0; margin: 0 auto; }
.pie-chart circle { transition: opacity .15s; }
.pie-chart svg:hover circle[stroke^="#"] { opacity: .55; }
.pie-chart svg circle[stroke^="#"]:hover { opacity: 1; }
.pie-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
.pie-center b { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
.pie-center span { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.pie-legend { list-style: none; flex: 1 1 200px; display: flex; flex-direction: column; gap: 4px; }
.pie-legend li { display: grid; grid-template-columns: 10px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; font-size: 13px; }
.pie-legend li:hover { background: var(--row-hover); }
.pie-legend i { width: 10px; height: 10px; border-radius: 3px; }
.pie-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pie-val { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pie-val b { color: var(--ink); font-weight: 600; }
.empty { padding: 28px 20px; text-align: center; color: var(--muted); border-top: 1px solid var(--line); }
.empty b { display: block; color: var(--ink); font-weight: 600; margin-bottom: 2px; }

/* Barra de filtros do detalhamento, como o FiltersBar */
.toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 0 20px 14px; }
.search { position: relative; flex: 1 1 240px; max-width: 360px; }
.search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.search input {
  width: 100%; height: 36px; padding: 0 12px 0 32px; border-radius: 12px; font: inherit; font-size: 13px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink); outline: none;
}
.search input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgb(255 61 3 / 0.18); }
.segmented { display: inline-flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); flex-wrap: wrap; }
.segmented button {
  border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; font-weight: 600;
  padding: 6px 12px; border-radius: 10px; cursor: pointer;
}
.segmented button:hover { color: var(--ink); }
.segmented button[aria-pressed="true"] { background: var(--brand); color: #fff; box-shadow: 0 4px 12px -6px rgb(255 61 3 / 0.7); }
.toolbar .shown { margin-left: auto; font-size: 12px; color: var(--muted); }

.foot { text-align: center; font-size: 12px; color: var(--muted); padding-top: 4px; }

@media (max-width: 860px) {
  .verdict { grid-template-columns: auto 1fr; }
  .verdict .goal { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .page { padding: 20px 16px 32px; gap: 18px; }
  .wordmark { text-align: left; }
  .toolbar .shown { margin-left: 0; width: 100%; }
}
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  :root { color-scheme: light; }
  body { background: #fff; font-size: 11.5px; }
  .page { max-width: none; padding: 0; gap: 14px; }
  .glass, .card { box-shadow: none; border: 1px solid #e5e7eb; background: #fff; backdrop-filter: none; break-inside: avoid; }
  .tbl-wrap { max-height: none !important; overflow: visible; }
  .tbl.wide { min-width: 0; }
  .tbl th { position: static; }
  .tbl tr { break-inside: avoid; }
  .toolbar { display: none; }
  .desc { -webkit-line-clamp: unset; display: block; }
  .detail-card { break-inside: auto; }
}
`

/** Filtro e "ver mais" da descrição; sem dependências. */
const EMBEDDED_JS = `
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('#detalhe tbody tr[data-grupo]'));
  var input = document.getElementById('busca');
  var shown = document.getElementById('mostrando');
  var empty = document.getElementById('detalhe-vazio');
  var filtro = 'todos';
  function norm(s) { return (s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); }
  function apply() {
    var q = norm(input ? input.value.trim() : '');
    var n = 0;
    rows.forEach(function (tr) {
      var ok = (filtro === 'todos' || tr.getAttribute('data-grupo') === filtro) &&
        (!q || norm(tr.textContent).indexOf(q) !== -1);
      tr.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    if (shown) shown.textContent = 'Mostrando ' + n + ' de ' + rows.length;
    if (empty) empty.style.display = n === 0 ? '' : 'none';
  }
  if (input) input.addEventListener('input', apply);
  Array.prototype.forEach.call(document.querySelectorAll('.segmented button'), function (btn) {
    btn.addEventListener('click', function () {
      filtro = btn.getAttribute('data-filtro');
      Array.prototype.forEach.call(document.querySelectorAll('.segmented button'), function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      apply();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.desc'), function (el) {
    el.addEventListener('click', function () { el.classList.toggle('open'); });
  });
  apply();
})();
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
  const dev = input.perfil === 'dev'
  fotosAtuais = input.fotos ?? {}
  const nomesCabecalho = person
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n && n !== 'Responsável')
  const visiveis = nomesCabecalho.slice(0, 4)
  const cabecalhoPessoas = visiveis.length
    ? `<div class="head-people${visiveis.length > 1 ? ' many' : ''}">${visiveis
        .map((n) => avatar(n))
        .join('')}${
        nomesCabecalho.length > visiveis.length
          ? `<span class="avatar more">+${nomesCabecalho.length - visiveis.length}</span>`
          : ''
      }</div>`
    : ''
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

  // Farol: vermelho com atraso em aberto; amarelo só com prazo a até 3 dias.
  const farol: 'g' | 'y' | 'r' =
    atrasados > 0 ? 'r' : risco > 0 ? 'y' : 'g'
  const farolInfo = {
    g: { titulo: 'Saudável', box: 'ib-emerald', icone: 'check' },
    y: { titulo: 'Requer atenção', box: 'ib-amber', icone: 'alert' },
    r: { titulo: 'Crítico', box: 'ib-rose', icone: 'octagon' },
  }[farol]

  // Resumo no formato "conclusão primeiro": o problema, depois o progresso.
  const vencendo = `${risco} ${plural(risco, 'vence', 'vencem')} nos próximos ${JANELA_RISCO_DIAS} dias`
  let alerta: string
  if (total === 0) {
    alerta = 'Nenhum item encontrado com os filtros usados.'
  } else if (atrasados > 0) {
    alerta = `<b>${atrasados} ${plural(atrasados, 'item atrasado precisa', 'itens atrasados precisam')} de ação</b>${
      risco > 0 ? ` e ${vencendo}` : ''
    }.`
  } else if (risco > 0) {
    alerta = `Nenhum atraso em aberto, mas <b>${vencendo}</b>.`
  } else if (abertos === 0) {
    alerta = '<b>Todos os itens foram entregues.</b>'
  } else {
    alerta = `<b>Tudo no prazo.</b> Nenhum atraso em aberto e nada vencendo nos próximos ${JANELA_RISCO_DIAS} dias.`
  }
  const progresso =
    total === 0
      ? ''
      : ` ${entregues} de ${total} ${plural(total, 'item entregue', 'itens entregues')}${
          entregues > 0
            ? comAtraso > 0
              ? `, ${comAtraso} fora do prazo`
              : ', todos dentro do prazo'
            : ''
        }.`

  const compLabel = formatCompetenciaLabel(input.competenciaMonth)
  const safePerson = escapeHtml(person)

  const kpis: Array<{
    label: string
    value: string
    hint: string
    box: string
    valueClass: string
    icone: keyof typeof ICON
  }> = [
    {
      label: 'Itens no mês',
      value: String(total),
      hint: `${abertos} em aberto`,
      box: 'ib-brand',
      valueClass: '',
      icone: 'layers',
    },
    {
      label: 'Entregues',
      value: `${conclusao}%`,
      hint: `${entregues} de ${total} ${plural(total, 'item', 'itens')}`,
      box: 'ib-emerald',
      valueClass: 'v-emerald',
      icone: 'check',
    },
    {
      label: 'No prazo',
      value: entregues ? `${pontualidade}%` : '—',
      hint: entregues
        ? `${noPrazo} no prazo · ${comAtraso} com atraso`
        : 'Sem entregas ainda',
      box: 'ib-sky',
      valueClass: 'v-sky',
      icone: 'clock',
    },
    {
      label: `Vencem em ${JANELA_RISCO_DIAS} dias`,
      value: String(risco),
      hint: `${andamento + pendentes} ${plural(andamento + pendentes, 'outro', 'outros')} em aberto`,
      box: 'ib-brand',
      valueClass: 'v-brand',
      icone: 'calendar',
    },
    {
      label: 'Atrasados',
      value: String(atrasados),
      hint: atrasados ? 'Em aberto, prazo vencido' : 'Nenhum em aberto',
      box: 'ib-rose',
      valueClass: 'v-rose',
      icone: 'alert',
    },
  ]
  const kpiHtml = kpis
    .map(
      (k) => `<div class="glass kpi">
        <div class="top">
          <div>
            <p class="label">${escapeHtml(k.label)}</p>
            <p class="value ${k.valueClass}">${escapeHtml(k.value)}</p>
          </div>
          <div class="icon-box ${k.box}">${icon(k.icone)}</div>
        </div>
        <p class="hint">${escapeHtml(k.hint)}</p>
      </div>`,
    )
    .join('')

  const stackParts: Array<[number, string, string]> = [
    [noPrazo, '#10b981', 'Entregue no prazo'],
    [comAtraso, '#6ee7b7', 'Entregue com atraso'],
    [andamento, '#0ea5e9', 'Em andamento'],
    [pendentes, '#94a3b8', 'Pendente'],
    [risco, '#ff6233', `Vence em até ${JANELA_RISCO_DIAS} dias`],
    [atrasados, '#e11d48', 'Atrasado'],
  ]
  const stack = stackParts
    .filter(([n]) => n > 0)
    .map(
      ([n, cor, nome]) =>
        `<span style="flex:${n};background:${cor}" title="${escapeHtml(nome)}: ${n}"></span>`,
    )
    .join('')
  const legend = stackParts
    .map(
      ([n, cor, nome]) =>
        `<span><i style="background:${cor}"></i>${escapeHtml(nome)} <b>${n}</b></span>`,
    )
    .join('')

  const celulaItem = (l: Linha, opts: { desc?: boolean; meta?: string }) => {
    const meta = opts.meta ?? l.empresa
    return `<div class="item-title">${escapeHtml(l.oQue)}</div>${
      meta && meta !== '—' ? `<div class="item-meta">${escapeHtml(meta)}</div>` : ''
    }${
      opts.desc && l.descricao
        ? `<div class="desc" title="Clique para ver tudo">${escapeHtml(l.descricao)}</div>`
        : ''
    }`
  }

  const celulaAtencao = (l: Linha) => {
    const meta = [
      l.responsavel !== '—' ? pessoa(l.responsavel) : '',
      l.empresa !== '—' ? `<span>${escapeHtml(l.empresa)}</span>` : '',
    ]
      .filter(Boolean)
      .join('<span class="sep">·</span>')
    return `<div class="item-title">${escapeHtml(l.oQue)}</div>${
      meta ? `<div class="item-meta row-meta">${meta}</div>` : ''
    }`
  }

  // Atrasos em aberto e entregas fora do prazo, com a justificativa.
  const atencao = linhas
    .filter((l) => l.situacao === 'atrasado' || l.situacao === 'entregue_atraso')
    .sort(porCriticidade)
  const atencaoRows = atencao
    .map((l) => {
      const motivo = l.motivo
        ? `<div class="note"><b>Motivo:</b> ${escapeHtml(l.motivo)}</div>`
        : l.situacao === 'atrasado'
          ? '<div class="note missing">Sem justificativa registrada</div>'
          : ''
      return `<tr>
          <td>${celulaAtencao(l)}${motivo}</td>
          <td class="date">${escapeHtml(formatDate(l.prazo))}</td>
          <td>${situacaoBadge(l)}</td>
        </tr>`
    })
    .join('')

  // Próximos prazos: itens abertos que ainda estão no prazo.
  const proximos = linhas
    .filter((l) => l.situacao === 'risco' || l.situacao === 'andamento' || l.situacao === 'pendente')
    .sort(porPrazo)
  const proximosRows = proximos
    .map(
      (l) => `<tr>
          <td>${celulaAtencao(l)}</td>
          <td class="date">${escapeHtml(formatDate(l.prazo))}</td>
          <td>${situacaoBadge(l)}</td>
        </tr>`,
    )
    .join('')

  const tabelaAtencao = (
    rows: string,
    vazioTitulo: string,
    vazioTexto: string,
  ) =>
    rows
      ? `<div class="tbl-wrap" style="--h: 380px"><table class="tbl fixed"><colgroup><col /><col style="width:108px" /><col style="width:168px" /></colgroup><thead><tr><th>Item</th><th>Prazo</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><b>${escapeHtml(vazioTitulo)}</b>${escapeHtml(vazioTexto)}</div>`

  const porResp = agrupar(linhas, (l) =>
    l.responsavel === '—'
      ? ['Sem responsável']
      : l.responsavel.split(' / ').map((n) => n.trim()).filter(Boolean),
  )
  const blocosGrupo: string[] = []
  if (porResp.length > 1) {
    blocosGrupo.push(
      tabelaGrupos({
        titulo: 'Por responsável',
        sub: 'Quem concentra os atrasos e o que falta entregar',
        coluna: 'Responsável',
        grupos: porResp,
        comPessoa: true,
      }),
    )
  }
  if (dev) {
    blocosGrupo.push(
      graficoGrupos({
        titulo: 'Por solicitante',
        sub: 'Quem originou as demandas do mês e em que situação elas estão',
        grupos: agrupar(linhas, (l) => [l.solicitante]),
      }),
      graficoRosca({
        titulo: 'Por tipo de atividade',
        sub: 'Como os itens do mês se dividem entre os tipos',
        grupos: agrupar(linhas, (l) => [l.tipo]),
      }),
    )
  } else {
    const porBu = agrupar(linhas, (l) => [l.bu])
    if (porBu.length > 1) {
      blocosGrupo.push(
        tabelaGrupos({
          titulo: 'Por BU',
          sub: 'Andamento de cada unidade de negócio',
          coluna: 'BU',
          grupos: porBu,
        }),
      )
    }
    blocosGrupo.push(
      tabelaGrupos({
        titulo: 'Por empresa',
        sub: 'Empresas com atraso aparecem primeiro',
        coluna: 'Empresa',
        grupos: agrupar(linhas, (l) => [l.empresa]),
      }),
    )
  }

  const detalheRows = [...linhas]
    .sort(porCriticidade)
    .map((l) => {
      const horario = formatHorario(l.item.horaInicio, l.item.horaFim)
      const meta = [
        l.item.origem === 'obrigacao' ? 'Obrigação' : 'Tarefa',
        dev && l.item.origem === 'tarefa' ? l.solicitante : null,
        horario,
      ]
        .filter(Boolean)
        .join(' · ')
      return `<tr data-grupo="${grupoFiltro(l)}">
          <td>${celulaItem(l, { desc: true, meta })}</td>
          <td>${pessoa(l.responsavel)}</td>
          <td class="date">${escapeHtml(formatDate(l.prazo))}</td>
          <td class="date">${escapeHtml(
            l.entrega && isEntregue(l.item.status) ? formatDate(l.entrega) : '—',
          )}</td>
          <td>${situacaoBadge(l)}</td>
        </tr>`
    })
    .join('')

  const contaGrupo = (g: GrupoFiltro) =>
    linhas.filter((l) => grupoFiltro(l) === g).length
  const filtros: Array<[string, string, number]> = [
    ['todos', 'Todos', total],
    ['atrasado', 'Atrasados', contaGrupo('atrasado')],
    ['risco', 'Vencendo', contaGrupo('risco')],
    ['aberto', 'Em aberto', contaGrupo('aberto')],
    ['entregue', 'Entregues', contaGrupo('entregue')],
  ]

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Checkpoint · ${safePerson} · ${escapeHtml(compLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
  <style>${EMBEDDED_CSS}</style>
</head>
<body>
  <div class="page">
    <header class="page-head">
      <div class="head-main">
        ${cabecalhoPessoas}
        <div>
          <span class="chip"><span class="dot"></span>Checkpoint</span>
          <h1>${escapeHtml(compLabel)}</h1>
          <p class="lead">${safePerson} · Gerado em ${escapeHtml(formatGeneratedDate(input.generatedAt))}</p>
        </div>
      </div>
      <div class="wordmark">nstech<small>Your Logistics Advantage</small></div>
    </header>

    <section class="glass verdict" aria-label="Resumo">
      <div class="icon-box ${farolInfo.box}">${icon(farolInfo.icone as keyof typeof ICON, 24)}</div>
      <div>
        <p class="eyebrow">Situação geral</p>
        <p class="title">${farolInfo.titulo}</p>
        <p class="text">${alerta}${progresso}</p>
      </div>
      <div class="goal">
        <div class="row"><span>Concluído</span><b>${conclusao}%</b></div>
        <div class="bar"><span style="width:${conclusao}%"></span></div>
        <small>${entregues} de ${total} ${plural(total, 'item', 'itens')} entregues</small>
      </div>
    </section>

    <section class="kpis" aria-label="Indicadores">${kpiHtml}</section>

    <section class="card" aria-label="Distribuição">
      ${cardHead('Distribuição por situação', 'Como os itens do mês estão divididos hoje')}
      <div class="dist">
        <div class="stack">${stack}</div>
        <div class="legend">${legend}</div>
      </div>
    </section>

    <h2 class="section-title">O que precisa de atenção</h2>
    <div class="grid-2">
      <section class="card">
        ${cardHead('Atrasos', 'Itens em aberto com prazo vencido e entregas feitas fora do prazo', atencao.length)}
        ${tabelaAtencao(atencaoRows, 'Nenhum atraso', 'Todas as entregas estão dentro do prazo.')}
      </section>
      <section class="card">
        ${cardHead('Próximos prazos', 'Itens em aberto, do prazo mais próximo ao mais distante', proximos.length)}
        ${tabelaAtencao(proximosRows, 'Nada em aberto', 'Não há itens pendentes dentro do prazo.')}
      </section>
    </div>

    <h2 class="section-title">Visão consolidada</h2>
    <div class="grid-2">
      ${blocosGrupo.join('\n')}
    </div>

    <h2 class="section-title">Detalhamento</h2>
    <section class="card detail-card" id="detalhe">
      ${cardHead('Todos os itens', 'Ordenados por criticidade. Clique na descrição para ler o texto completo.', total)}
      <div class="toolbar">
        <label class="search">${icon('search', 16)}<input id="busca" type="search" placeholder="Buscar por item ou pessoa" aria-label="Buscar" /></label>
        <div class="segmented" role="group" aria-label="Filtrar por situação">
          ${filtros
            .map(
              ([key, label, n], i) =>
                `<button type="button" data-filtro="${key}" aria-pressed="${i === 0}">${label} · ${n}</button>`,
            )
            .join('')}
        </div>
        <span class="shown" id="mostrando"></span>
      </div>
      <div class="tbl-wrap x" style="--h: 560px">
        <table class="tbl wide">
          <thead><tr>
            <th>Item</th><th>Responsável</th>
            <th>Prazo</th><th>Entrega</th><th>Situação</th>
          </tr></thead>
          <tbody>${detalheRows}</tbody>
        </table>
        <div class="empty" id="detalhe-vazio" style="display:none"><b>Nenhum item encontrado</b>Ajuste a busca ou o filtro.</div>
      </div>
    </section>

    <p class="foot">Situação calculada em ${escapeHtml(formatDate(hoje))}. “Vencem em ${JANELA_RISCO_DIAS} dias” considera itens em aberto com prazo em até ${JANELA_RISCO_DIAS} dias corridos.</p>
  </div>
  <script>${EMBEDDED_JS}</script>
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
