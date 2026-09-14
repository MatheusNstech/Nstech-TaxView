import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { formatDate, formatMoneyBRL } from '../../lib/format'
import type { PainelFiscalPendencia } from '../../types'

export type SheetDefaults = {
  empresa: string
  razao_social: string
  cnpj: string
  uf: string
  ano: number | null
  mes: number | null
}

type SheetField =
  | 'orgao'
  | 'total'
  | 'principal'
  | 'multa'
  | 'juros'
  | 'status_cnd'
  | 'cnd'
  | 'validade_cnd'
  | 'nota_01'
  | 'nota_02'
  | 'motivo'

type CellValues = Record<SheetField, string>

type SheetRow = {
  key: string
  id: string | null
  values: CellValues
  baseline: CellValues
  saving?: boolean
  error?: string
}

const COLUMNS: {
  key: SheetField
  label: string
  wide?: boolean
  money?: boolean
  minWidth: string
}[] = [
  { key: 'orgao', label: 'Órgão', minWidth: '7rem' },
  { key: 'total', label: 'Total', money: true, minWidth: '9rem' },
  { key: 'principal', label: 'Principal', money: true, minWidth: '9rem' },
  { key: 'multa', label: 'Multa', money: true, minWidth: '8rem' },
  { key: 'juros', label: 'Juros', money: true, minWidth: '8rem' },
  { key: 'status_cnd', label: 'Status CND', minWidth: '9rem' },
  { key: 'cnd', label: 'CND', wide: true, minWidth: '16rem' },
  { key: 'validade_cnd', label: 'Validade', minWidth: '9rem' },
  { key: 'nota_01', label: 'Nota 01', wide: true, minWidth: '18rem' },
  { key: 'nota_02', label: 'Nota 02', wide: true, minWidth: '18rem' },
  { key: 'motivo', label: 'Motivo', wide: true, minWidth: '16rem' },
]

function moneyToInput(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  return String(value)
}

function parseMoney(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function emptyValues(): CellValues {
  return {
    orgao: '',
    total: '',
    principal: '',
    multa: '',
    juros: '',
    status_cnd: '',
    cnd: '',
    validade_cnd: '',
    nota_01: '',
    nota_02: '',
    motivo: '',
  }
}

function valuesFromPendencia(row: PainelFiscalPendencia): CellValues {
  return {
    orgao: row.orgao ?? '',
    total: moneyToInput(row.total),
    principal: moneyToInput(row.principal),
    multa: moneyToInput(row.multa),
    juros: moneyToInput(row.juros),
    status_cnd: row.status_cnd ?? '',
    cnd: row.cnd ?? '',
    validade_cnd: row.validade_cnd ?? '',
    nota_01: row.nota_01 ?? '',
    nota_02: row.nota_02 ?? '',
    motivo: row.motivo ?? '',
  }
}

function rowFromPendencia(row: PainelFiscalPendencia): SheetRow {
  const values = valuesFromPendencia(row)
  return {
    key: row.id,
    id: row.id,
    values,
    baseline: { ...values },
  }
}

function emptyDraft(draftKey: string): SheetRow {
  const values = emptyValues()
  return {
    key: draftKey,
    id: null,
    values,
    baseline: { ...values },
  }
}

function SheetTextarea({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      className="glass-input min-h-[5.5rem] w-full min-w-0 resize-none overflow-hidden py-1.5 text-xs leading-snug"
      rows={4}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function fieldPayload(
  field: SheetField,
  raw: string,
): Record<string, string | number | null> {
  if (
    field === 'total' ||
    field === 'principal' ||
    field === 'multa' ||
    field === 'juros'
  ) {
    return { [field]: parseMoney(raw) }
  }
  if (field === 'validade_cnd') {
    const text = raw.trim()
    return { validade_cnd: text || null }
  }
  return { [field]: raw.trim() }
}

function createPayload(row: SheetRow, defaults: SheetDefaults) {
  return {
    empresa: defaults.empresa.trim(),
    razao_social: defaults.razao_social.trim(),
    cnpj: defaults.cnpj.replace(/\D/g, ''),
    uf: defaults.uf.trim(),
    orgao: row.values.orgao.trim(),
    status_cnd: row.values.status_cnd.trim(),
    cnd: row.values.cnd.trim(),
    validade_cnd: row.values.validade_cnd.trim() || null,
    ano: defaults.ano,
    mes: defaults.mes,
    total: parseMoney(row.values.total),
    principal: parseMoney(row.values.principal),
    multa: parseMoney(row.values.multa),
    juros: parseMoney(row.values.juros),
    motivo: row.values.motivo.trim(),
    nota_01: row.values.nota_01.trim(),
    nota_02: row.values.nota_02.trim(),
  }
}

function rowIsDirty(row: SheetRow): boolean {
  if (!row.id) return true
  return (Object.keys(row.values) as SheetField[]).some(
    (field) => row.values[field] !== row.baseline[field],
  )
}

function updatePayload(row: SheetRow): Record<string, string | number | null> {
  const payload: Record<string, string | number | null> = {}
  for (const field of Object.keys(row.values) as SheetField[]) {
    if (row.values[field] === row.baseline[field]) continue
    Object.assign(payload, fieldPayload(field, row.values[field]))
  }
  return payload
}

export default function PainelFiscalEmpresaSheet({
  rows,
  defaults,
  editable,
  onChanged,
}: {
  rows: PainelFiscalPendencia[]
  defaults: SheetDefaults
  editable: boolean
  onChanged: () => Promise<void> | void
}) {
  const [sheetRows, setSheetRows] = useState<SheetRow[]>(() =>
    rows.map(rowFromPendencia),
  )
  const [draftSeq, setDraftSeq] = useState(0)
  const sheetRowsRef = useRef(sheetRows)
  sheetRowsRef.current = sheetRows

  useEffect(() => {
    setSheetRows((prev) => {
      const drafts = prev.filter((r) => !r.id)
      return [...rows.map(rowFromPendencia), ...drafts]
    })
  }, [rows])

  const totalLocal = useMemo(
    () =>
      sheetRows.reduce((sum, row) => sum + (parseMoney(row.values.total) ?? 0), 0),
    [sheetRows],
  )

  const updateCell = (key: string, field: SheetField, value: string) => {
    setSheetRows((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              error: undefined,
              values: { ...row.values, [field]: value },
            }
          : row,
      ),
    )
  }

  const patchRow = (key: string, patch: Partial<SheetRow>) => {
    setSheetRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  const saveExistingRow = async (rowKey: string) => {
    const row = sheetRowsRef.current.find((r) => r.key === rowKey)
    if (!editable || !row?.id || !rowIsDirty(row)) return

    const payload = updatePayload(row)
    if (Object.keys(payload).length === 0) return

    patchRow(rowKey, { saving: true, error: undefined })
    try {
      const updated = await apiFetch<PainelFiscalPendencia>(
        `/api/painel-fiscal/${row.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      )
      setSheetRows((prev) =>
        prev.map((r) => (r.key === rowKey ? rowFromPendencia(updated) : r)),
      )
    } catch (err) {
      patchRow(rowKey, {
        saving: false,
        error: err instanceof Error ? err.message : 'Falha ao salvar',
      })
      throw err
    }
  }

  const saveDraft = async (rowKey: string) => {
    const row = sheetRowsRef.current.find((r) => r.key === rowKey)
    if (!editable || !row || row.id) return
    if (!defaults.empresa.trim()) {
      patchRow(rowKey, { error: 'Informe a empresa' })
      throw new Error('Informe a empresa')
    }
    if (!row.values.orgao.trim()) {
      patchRow(rowKey, { error: 'Informe o órgão' })
      throw new Error('Informe o órgão')
    }
    patchRow(rowKey, { saving: true, error: undefined })
    try {
      const created = await apiFetch<PainelFiscalPendencia>('/api/painel-fiscal', {
        method: 'POST',
        body: JSON.stringify(createPayload(row, defaults)),
      })
      setSheetRows((prev) =>
        prev.map((r) => (r.key === rowKey ? rowFromPendencia(created) : r)),
      )
    } catch (err) {
      patchRow(rowKey, {
        saving: false,
        error: err instanceof Error ? err.message : 'Falha ao criar',
      })
      throw err
    }
  }

  const addDraft = () => {
    const next = draftSeq + 1
    setDraftSeq(next)
    setSheetRows((prev) => [...prev, emptyDraft(`draft-${Date.now()}-${next}`)])
  }

  const dirtyRows = useMemo(
    () => sheetRows.filter((r) => rowIsDirty(r)),
    [sheetRows],
  )
  const hasChanges = dirtyRows.length > 0
  const saving = sheetRows.some((r) => r.saving)
  const saveError = sheetRows.find((r) => r.error)?.error

  const saveAll = async () => {
    const pending = sheetRowsRef.current.filter((r) => rowIsDirty(r))
    try {
      for (const row of pending) {
        if (row.id) await saveExistingRow(row.key)
        else await saveDraft(row.key)
      }
      await onChanged()
    } catch {
      // erros já ficam na linha
    }
  }

  if (!editable) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-white dark:bg-[color:var(--color-panel)]">
            <tr className="border-b border-[color:var(--color-line)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
              <th className="px-4 py-3 font-semibold">Órgão</th>
              <th className="px-4 py-3 font-semibold">Status CND</th>
              <th className="px-4 py-3 font-semibold">CND</th>
              <th className="px-4 py-3 font-semibold">Validade</th>
              <th className="px-4 py-3 font-semibold">Observação</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-[color:var(--color-muted)]"
                >
                  Nenhuma linha nesta empresa
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[color:var(--color-line)] align-top"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[color:var(--color-ink)]">
                    {row.orgao || '—'}
                  </td>
                  <td className="px-4 py-3">{row.status_cnd || '—'}</td>
                  <td className="max-w-[12rem] px-4 py-3">{row.cnd || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {row.validade_cnd ? formatDate(row.validade_cnd) : '—'}
                  </td>
                  <td className="max-w-sm px-4 py-3 text-xs text-[color:var(--color-muted)]">
                    {row.nota_01 || row.nota_02 || row.motivo || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatMoneyBRL(row.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-white dark:bg-[color:var(--color-panel)]">
            <tr className="border-b border-[color:var(--color-line)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{ minWidth: col.minWidth, width: col.minWidth }}
                  className={`px-2 py-2.5 font-semibold ${col.money ? 'text-right' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetRows.map((row) => (
              <tr
                key={row.key}
                className="border-b border-[color:var(--color-line)] align-top"
              >
                {COLUMNS.map((col) => {
                  const isWide =
                    col.key === 'nota_01' ||
                    col.key === 'nota_02' ||
                    col.key === 'motivo'
                  return (
                    <td
                      key={col.key}
                      style={{ minWidth: col.minWidth, width: col.minWidth }}
                      className="px-1.5 py-1.5"
                    >
                      {isWide ? (
                        <SheetTextarea
                          value={row.values[col.key]}
                          disabled={row.saving}
                          onChange={(next) => updateCell(row.key, col.key, next)}
                        />
                      ) : (
                        <input
                          className={`glass-input box-border w-full min-w-0 py-1.5 text-xs ${col.money ? 'text-right tabular-nums' : ''}`}
                          value={row.values[col.key]}
                          disabled={row.saving}
                          placeholder={
                            col.key === 'validade_cnd' ? 'AAAA-MM-DD' : undefined
                          }
                          onChange={(e) =>
                            updateCell(row.key, col.key, e.target.value)
                          }
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-line)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-[color:var(--color-muted)]">
            Total na grade ·{' '}
            <span className="font-semibold text-[color:var(--color-ink)]">
              {formatMoneyBRL(totalLocal)}
            </span>
            <span className="ml-2">· clique em Salvar para gravar as alterações</span>
          </p>
          {saveError ? (
            <p className="mt-1 text-[11px] text-rose-600">{saveError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!hasChanges || saving}
            onClick={() => void saveAll()}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="btn-ghost" onClick={addDraft}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Nova linha
          </button>
        </div>
      </div>
    </div>
  )
}
