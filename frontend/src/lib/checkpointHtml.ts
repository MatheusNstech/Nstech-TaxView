import { formatDate, formatHorario, statusLabel } from './format'
import type { StatusObrigacao, WorkItem } from '../types'

export interface CheckpointHtmlInput {
  personName: string
  competenciaMonth: string
  generatedAt: Date
  items: WorkItem[]
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0]
  return part || 'usuario'
}

function formatGeneratedDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatCompetenciaLabel(month: string): string {
  const [y, m] = month.split('-')
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  const idx = Number(m) - 1
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return month
  return `${months[idx]}/${y}`
}

function progressPct(status: StatusObrigacao): number {
  if (status === 'ENTREGUE') return 100
  if (status === 'EM_REVISAO') return 80
  if (status === 'EM_ANDAMENTO') return 50
  return 0
}

function statusChipLabel(status: StatusObrigacao): string {
  const labels: Record<StatusObrigacao, string> = {
    PENDENTE: 'PENDENTE',
    EM_ANDAMENTO: 'EM ANDAMENTO',
    EM_REVISAO: 'EM REVISÃO',
    ENTREGUE: 'ENTREGUE',
    ATRASADO: 'ATRASADO',
  }
  return labels[status] ?? status
}

function statusChipClass(item: WorkItem): string {
  if (item.status === 'ENTREGUE') return 'st-ok'
  if (item.status === 'ATRASADO' || item.urgencia === 'atrasado') return 'st-late'
  if (item.status === 'EM_ANDAMENTO') return 'st-run'
  if (item.status === 'EM_REVISAO') return 'st-rev'
  return 'st-plan'
}

function solicitanteOf(item: WorkItem): string {
  return (
    item.solicitanteNome?.trim() ||
    item.tarefa?.solicitante_nome?.trim() ||
    '—'
  )
}

function sortByPrazo(a: WorkItem, b: WorkItem): number {
  const pa = a.prazo?.slice(0, 10) || '9999-99-99'
  const pb = b.prazo?.slice(0, 10) || '9999-99-99'
  return pa.localeCompare(pb)
}

const EMBEDDED_CSS = `
:root {
  --laranja: #FF5B1F;
  --laranja-deep: #E84E14;
  --verde: #34C759;
  --amarelo: #FFC107;
  --vermelho: #FF3B30;
  --cinza: #DADADA;
  --cinza-texto: #6B7280;
  --fundo: #F7F8FA;
  --card: #FFFFFF;
  --texto: #1A1A1A;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: Montserrat, system-ui, sans-serif;
  background: var(--fundo);
  color: var(--texto);
  line-height: 1.45;
}
.cover {
  position: relative;
  min-height: 100vh;
  background: var(--laranja);
  color: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(28px, 4vw, 48px) clamp(24px, 5vw, 64px) clamp(24px, 3vw, 40px);
}
.cover::before, .cover::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.cover::before {
  width: 70vmax; height: 70vmax; right: -22%; top: -18%;
  background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 68%);
}
.cover::after {
  width: 55vmax; height: 55vmax; right: -8%; bottom: -30%;
  background: var(--laranja-deep); opacity: 0.45;
  border-radius: 42% 58% 55% 45% / 48% 42% 58% 52%;
}
.cover-shapes { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.cover-shapes span {
  position: absolute;
  background: rgba(255,255,255,0.06);
  border-radius: 40% 60% 55% 45%;
}
.cover-shapes span:nth-child(1) {
  width: 48vw; height: 48vw; max-width: 640px; max-height: 640px;
  right: -8%; top: 8%; background: rgba(232, 78, 20, 0.5);
}
.cover-shapes span:nth-child(2) {
  width: 36vw; height: 36vw; max-width: 480px; max-height: 480px;
  right: 6%; bottom: -12%; background: rgba(255,255,255,0.08);
  border-radius: 55% 45% 48% 52%;
}
.cover-top, .cover-mid, .cover-foot { position: relative; z-index: 1; }
.pill {
  display: inline-block;
  background: #fff;
  color: var(--laranja);
  font-weight: 700;
  font-size: 0.82rem;
  padding: 8px 16px;
  border-radius: 6px;
}
.cover-title-row {
  display: flex; align-items: center; gap: 18px;
  margin-top: clamp(36px, 8vh, 72px);
}
.cover-rays {
  width: 42px; height: 42px; flex-shrink: 0;
  background: conic-gradient(from 0deg, transparent 0 8deg, #fff 8deg 14deg, transparent 14deg 30deg);
  mask: radial-gradient(circle, transparent 38%, #000 39%);
  -webkit-mask: radial-gradient(circle, transparent 38%, #000 39%);
}
.cover h1 {
  font-size: clamp(1.75rem, 4.5vw, 3rem);
  font-weight: 800; font-style: italic;
  letter-spacing: -0.02em; line-height: 1.1;
}
.cover h1 .v {
  font-size: 0.42em; font-weight: 600; font-style: normal;
  vertical-align: super; margin-left: 6px; opacity: 0.9;
}
.agenda { margin: clamp(48px, 12vh, 100px) 0 clamp(24px, 6vh, 48px); }
.agenda-line {
  display: grid; grid-template-columns: repeat(4, 1fr);
  position: relative;
}
.agenda-line::before {
  content: ""; position: absolute; left: 0; right: 0; top: 50%;
  height: 1px; background: rgba(255,255,255,0.85); transform: translateY(-50%);
}
.agenda-item {
  position: relative; text-decoration: none; color: #fff;
  min-height: 72px; display: flex; flex-direction: column; justify-content: center;
}
.agenda-item::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0;
  width: 1px; background: rgba(255,255,255,0.55);
}
.agenda-item:first-child::before { display: none; }
.agenda-item .label {
  font-size: clamp(0.68rem, 1.1vw, 0.82rem);
  font-style: italic; font-weight: 500;
  padding: 0 12px 14px 10px; opacity: 0.95;
}
.agenda-item .tick {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em;
  padding: 14px 12px 0 10px;
}
.cover-foot {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 16px; flex-wrap: wrap;
}
.brand .name { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.03em; }
.brand .tag {
  font-size: 0.58rem; font-weight: 500; letter-spacing: 0.12em;
  text-transform: uppercase; opacity: 0.85; margin-top: 4px;
}
.cover-date { font-size: 0.95rem; font-weight: 600; }
.content {
  max-width: 1100px; margin: 0 auto;
  padding: 40px 24px 48px;
  display: flex; flex-direction: column; gap: 20px;
}
.sec { scroll-margin-top: 24px; }
.sec-label {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--cinza-texto); margin-bottom: 12px;
}
.card {
  background: var(--card); border-radius: 12px;
  border: 1px solid #ECEFF3; padding: 20px 22px;
}
.kpi-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.kpi {
  background: var(--card); border-radius: 12px; border: 1px solid #ECEFF3;
  padding: 18px 20px; border-top: 3px solid var(--accent, var(--laranja));
}
.kpi .k { font-size: 0.78rem; color: var(--cinza-texto); font-weight: 600; }
.kpi .v {
  font-size: clamp(1.8rem, 3vw, 2.4rem); font-weight: 800;
  letter-spacing: -0.03em; margin-top: 4px;
}
.split {
  display: grid;
  grid-template-columns: 1.45fr 0.75fr;
  gap: 16px;
  align-items: stretch;
}
.card-fixed {
  display: flex;
  flex-direction: column;
  height: 420px;
  min-height: 420px;
  max-height: 420px;
  overflow: hidden;
  padding-bottom: 14px;
}
.card-fixed .sec-label { flex-shrink: 0; }
.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin: 0 -6px;
  padding: 0 6px;
  scrollbar-width: thin;
  scrollbar-color: #d0d5dd transparent;
}
.table-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
.table-scroll::-webkit-scrollbar-thumb {
  background: #d0d5dd;
  border-radius: 999px;
}
.table-scroll table { width: 100%; border-collapse: separate; border-spacing: 0; }
.table-scroll thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--card);
  box-shadow: 0 1px 0 #ECEFF3;
  padding-top: 2px;
}
.table-scroll th {
  text-align: left; font-size: 0.68rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--cinza-texto);
  padding: 8px 8px 10px 0; font-weight: 600;
}
.table-scroll td {
  padding: 10px 8px 10px 0;
  border-bottom: 1px solid #F3F5F8;
  vertical-align: middle;
}
.table-scroll tr:last-child td { border-bottom: none; }
.table-scroll td:last-child,
.table-scroll th:last-child { padding-right: 0; text-align: right; }
.col-proj { width: 34%; }
.col-sol { width: 16%; }
.col-prazo { width: 14%; }
.col-hora { width: 16%; }
.col-status { width: 20%; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
th {
  text-align: left; font-size: 0.68rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--cinza-texto);
  padding-bottom: 10px; border-bottom: 1px solid #ECEFF3; font-weight: 600;
}
td { padding: 9px 0; border-bottom: 1px solid #F3F5F8; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
.muted { color: var(--cinza-texto); font-size: 0.82rem; }
.dot {
  display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; vertical-align: middle;
}
.dot.ok { background: var(--verde); }
.dot.warn { background: var(--amarelo); }
.dot.plan { background: #C4C8CE; }
.dot.late { background: var(--vermelho); }
.status-chip {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.status-chip.st-ok { background: #E8F8EE; color: #1B7A3A; }
.status-chip.st-run { background: #FFF4E0; color: #9A6B00; }
.status-chip.st-rev { background: #EEF2FF; color: #3B4CCA; }
.status-chip.st-plan { background: #F1F3F5; color: #5B6470; }
.status-chip.st-late { background: #FFE8E6; color: #C62828; }
.gauge-wrap {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; flex: 1; min-height: 0;
}
.gauge-label { margin-top: -6px; text-align: center; }
.gauge-label .big {
  font-size: 1.85rem; font-weight: 800; color: var(--laranja); letter-spacing: -0.03em;
}
.gauge-label .small { font-size: 0.78rem; color: var(--cinza-texto); font-weight: 500; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.bullets { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.bullets li {
  font-size: 0.88rem; font-weight: 500; padding: 10px 12px;
  background: #F8FAFC; border-radius: 8px; border: 1px solid #EEF1F5;
}
.bullets li .meta {
  display: block; margin-top: 4px; font-size: 0.75rem;
  color: var(--cinza-texto); font-weight: 500;
}
@media (max-width: 860px) {
  .kpi-strip, .split, .two { grid-template-columns: 1fr; }
  .agenda-line { grid-template-columns: 1fr; }
  .agenda-line::before { display: none; }
  .card-fixed {
    height: 360px;
    min-height: 360px;
    max-height: 360px;
  }
}
@media print {
  .cover { min-height: auto; page-break-after: always; }
  .card-fixed {
    height: auto;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }
  .table-scroll { overflow: visible; }
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
  const items = [...input.items].sort(sortByPrazo)
  const entregue = items.filter((i) => i.status === 'ENTREGUE')
  const emCurso = items.filter(
    (i) => i.status === 'EM_ANDAMENTO' || i.status === 'EM_REVISAO',
  )
  const pendentes = items.filter(
    (i) =>
      i.status === 'PENDENTE' ||
      i.status === 'ATRASADO' ||
      (i.status !== 'ENTREGUE' &&
        i.status !== 'EM_ANDAMENTO' &&
        i.status !== 'EM_REVISAO'),
  )
  const gaugePct =
    items.length === 0
      ? 0
      : Math.round(
          (items.reduce((sum, i) => sum + progressPct(i.status), 0) /
            (items.length * 100)) *
            100,
        )

  const highlights = entregue.slice(0, 5)
  const proximos = items
    .filter((i) => i.status !== 'ENTREGUE')
    .sort(sortByPrazo)
    .slice(0, 5)

  const genDate = formatGeneratedDate(input.generatedAt)
  const compLabel = formatCompetenciaLabel(input.competenciaMonth)
  const safePerson = escapeHtml(person)

  const roadmapRows = items
    .map((item) => {
      const horario =
        formatHorario(item.horaInicio, item.horaFim) || '—'
      const prazo = formatDate(item.prazo)
      const title = escapeHtml(item.title)
      const chip = statusChipClass(item)
      const label = escapeHtml(statusChipLabel(item.status))
      const solicitante = escapeHtml(solicitanteOf(item))
      return `<tr>
              <td class="col-proj">${title}</td>
              <td class="col-sol muted">${solicitante}</td>
              <td class="col-prazo muted">${escapeHtml(prazo)}</td>
              <td class="col-hora muted">${escapeHtml(horario)}</td>
              <td class="col-status"><span class="status-chip ${chip}">${label}</span></td>
            </tr>`
    })
    .join('\n')

  const execRows = items
    .map((item) => {
      const chip = statusChipClass(item)
      const label = escapeHtml(statusChipLabel(item.status))
      return `<tr>
              <td>${escapeHtml(item.title)}</td>
              <td class="muted">${escapeHtml(solicitanteOf(item))}</td>
              <td class="muted">${escapeHtml(formatDate(item.prazo))}</td>
              <td class="muted">${escapeHtml(formatHorario(item.horaInicio, item.horaFim) || '—')}</td>
              <td><span class="status-chip ${chip}">${label}</span></td>
            </tr>`
    })
    .join('\n')

  const highlightLis =
    highlights.length === 0
      ? '<li>Nenhuma entrega concluída neste filtro</li>'
      : highlights
          .map((item) => {
            const meta = [
              formatDate(item.prazo),
              formatHorario(item.horaInicio, item.horaFim),
            ]
              .filter(Boolean)
              .join(' · ')
            return `<li>${escapeHtml(item.title)}${
              meta
                ? `<span class="meta">${escapeHtml(meta)}</span>`
                : ''
            }</li>`
          })
          .join('\n')

  const proximoLis =
    proximos.length === 0
      ? '<li>Nenhum item pendente neste filtro</li>'
      : proximos
          .map((item) => {
            const meta = [
              formatDate(item.prazo),
              formatHorario(item.horaInicio, item.horaFim),
              statusLabel(item.status),
            ]
              .filter(Boolean)
              .join(' · ')
            return `<li>${escapeHtml(item.title)}<span class="meta">${escapeHtml(meta)}</span></li>`
          })
          .join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Checkpoint · ${safePerson} · ${escapeHtml(compLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,600&display=swap" rel="stylesheet" />
  <style>${EMBEDDED_CSS}</style>
</head>
<body>
  <section class="cover" aria-label="Capa Checkpoint">
    <div class="cover-shapes" aria-hidden="true"><span></span><span></span></div>
    <div class="cover-top">
      <span class="pill">${safePerson} · ${escapeHtml(compLabel)}</span>
      <div class="cover-title-row">
        <div class="cover-rays" aria-hidden="true"></div>
        <h1>Minhas entregas<span class="v">v1</span></h1>
      </div>
    </div>
    <nav class="cover-mid agenda" aria-label="Seções">
      <div class="agenda-line">
        <a class="agenda-item" href="#farol"><span class="label">Farol</span><span class="tick">01</span></a>
        <a class="agenda-item" href="#roadmap"><span class="label">Roadmap</span><span class="tick">02</span></a>
        <a class="agenda-item" href="#execucao"><span class="label">Execução</span><span class="tick">03</span></a>
        <a class="agenda-item" href="#proximos"><span class="label">Próximos</span><span class="tick">04</span></a>
      </div>
    </nav>
    <footer class="cover-foot">
      <div class="brand">
        <div class="name">nstech</div>
        <div class="tag">Your Logistics Advantage</div>
      </div>
      <div class="cover-date">${escapeHtml(genDate)}</div>
    </footer>
  </section>

  <main class="content">
    <section class="sec" id="farol">
      <div class="sec-label">Farol</div>
      <div class="kpi-strip">
        <div class="kpi" style="--accent: var(--verde)">
          <div class="k">Entregues</div>
          <div class="v">${entregue.length}</div>
        </div>
        <div class="kpi" style="--accent: var(--amarelo)">
          <div class="k">Em andamento</div>
          <div class="v">${emCurso.length}</div>
        </div>
        <div class="kpi" style="--accent: var(--vermelho)">
          <div class="k">Pendentes</div>
          <div class="v">${pendentes.length}</div>
        </div>
      </div>
    </section>

    <section class="sec split" id="roadmap">
      <div class="card card-fixed">
        <div class="sec-label">Roadmap</div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th class="col-proj">Projeto</th>
                <th class="col-sol">Solicitante</th>
                <th class="col-prazo">Prazo</th>
                <th class="col-hora">Horário</th>
                <th class="col-status">Status</th>
              </tr>
            </thead>
            <tbody>
              ${roadmapRows || '<tr><td colspan="5" class="muted">Nenhum item</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card card-fixed">
        <div class="sec-label">Execução geral</div>
        <div class="gauge-wrap">
          <svg width="220" height="130" viewBox="0 0 240 140" aria-label="Execução geral ${gaugePct}%">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#FF5B1F" />
                <stop offset="100%" stop-color="#FF8A50" />
              </linearGradient>
            </defs>
            <path d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="#EEF1F5" stroke-width="16" stroke-linecap="round" />
            <path id="gaugeArc" d="M30 120 A90 90 0 0 1 210 120" fill="none" stroke="url(#gaugeGrad)" stroke-width="16" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283" />
          </svg>
          <div class="gauge-label">
            <div class="big" id="gaugePct">0%</div>
            <div class="small">${escapeHtml(compLabel)} · ${items.length} itens</div>
          </div>
        </div>
      </div>
    </section>

    <section class="sec card card-fixed" id="execucao">
      <div class="sec-label">Execução das entregas</div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th class="col-proj">Projeto</th>
              <th class="col-sol">Solicitante</th>
              <th class="col-prazo">Prazo</th>
              <th class="col-hora">Horário</th>
              <th class="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            ${execRows || '<tr><td colspan="5" class="muted">Nenhum item</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>

    <section class="sec two" id="proximos">
      <div class="card">
        <div class="sec-label">Highlights</div>
        <ul class="bullets">${highlightLis}</ul>
      </div>
      <div class="card">
        <div class="sec-label">Próximos passos</div>
        <ul class="bullets">${proximoLis}</ul>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const TARGET = ${gaugePct};
      const ARC = Math.PI * 90;
      function animateGauge() {
        const arc = document.getElementById("gaugeArc");
        const label = document.getElementById("gaugePct");
        if (!arc || !label) return;
        const offset = ARC * (1 - TARGET / 100);
        requestAnimationFrame(function () {
          arc.style.transition = "stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)";
          arc.style.strokeDashoffset = String(offset);
        });
        const start = performance.now();
        const duration = 1300;
        function tick(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          label.textContent = Math.round(TARGET * eased) + "%";
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }
      var done = false;
      function runOnce() {
        if (done) return;
        done = true;
        animateGauge();
      }
      if (document.readyState === "complete") runOnce();
      else window.addEventListener("load", runOnce);
    })();
  </script>
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
