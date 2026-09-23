import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tags } from 'lucide-react'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import NotificationBell from '../components/NotificationBell'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch, buildQuery } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  formatMoneyBRL,
  monthToCompetencia,
} from '../lib/format'

type TipoValor = 'iss' | 'pis_cofins'

interface ValorRow {
  id: string
  competencia: string
  tipo: TipoValor
  empresa_cnpj: string
  empresa_alias: string
  empresa_razao: string
  origem: string
  payload: Record<string, unknown>
  updated_at: string | null
  created_at: string | null
}

function formatCnpj(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length === 14) {
    return d.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    )
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return digits
}

function tipoLabel(tipo: TipoValor): string {
  return tipo === 'iss' ? 'ISS' : 'PIS/COFINS'
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function resumoPayload(row: ValorRow): string {
  const p = row.payload || {}
  if (row.tipo === 'iss') {
    const erp = num(p, 'erp_valor')
    const iss = num(p, 'iss_a_recolher') ?? num(p, 'erp_iss')
    const parts = [
      erp != null ? `ERP ${formatMoneyBRL(erp)}` : null,
      iss != null ? `ISS ${formatMoneyBRL(iss)}` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : '—'
  }
  const receita = num(p, 'receita_bruta') ?? num(p, 'erp_valor')
  const pis = num(p, 'pis_debito') ?? num(p, 'pis')
  const cofins = num(p, 'cofins_debito') ?? num(p, 'cofins')
  const parts = [
    receita != null ? `Receita ${formatMoneyBRL(receita)}` : null,
    pis != null ? `PIS ${formatMoneyBRL(pis)}` : null,
    cofins != null ? `COFINS ${formatMoneyBRL(cofins)}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

export default function DiretoriaValores() {
  const [competencia, setCompetencia] = useState(currentCompetenciaMonth())
  const [tipo, setTipo] = useState<'' | TipoValor>('')
  const [rows, setRows] = useState<ValorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = buildQuery({
        competencia: monthToCompetencia(competencia),
        tipo: tipo || undefined,
        limit: '200',
      })
      const data = await apiFetch<ValorRow[]>(`/api/valores${q}`)
      setRows(data)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Falha ao carregar valores')
    } finally {
      setLoading(false)
    }
  }, [competencia, tipo])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => {
    const iss = rows.filter((r) => r.tipo === 'iss').length
    const pis = rows.filter((r) => r.tipo === 'pis_cofins').length
    return { total: rows.length, iss, pis }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Valores
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Faturamento recebido do app desktop (ISS e PIS/COFINS).
          </p>
        </div>
        <NotificationBell />
      </div>

      <div className="glass-panel sticky top-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
        <GlassMonthPicker
          className="w-[8.25rem] shrink-0"
          value={competencia}
          onChange={setCompetencia}
        />
        <GlassSelect
          className="min-w-[9rem] flex-1 basis-[9rem]"
          icon={Tags}
          ariaLabel="Tipo"
          value={tipo}
          onChange={(v) => setTipo(v as '' | TipoValor)}
          options={[
            { value: '', label: 'Todos os tipos' },
            { value: 'iss', label: 'ISS' },
            { value: 'pis_cofins', label: 'PIS/COFINS' },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-2 text-xs text-[color:var(--color-muted)]">
          <span className="glass-chip">{counts.total} registros</span>
          <span className="glass-chip">ISS {counts.iss}</span>
          <span className="glass-chip">PIS/COFINS {counts.pis}</span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}

      {loading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="glass-panel p-8 text-center text-sm text-[color:var(--color-muted)]">
          Nenhum valor para {formatCompetencia(monthToCompetencia(competencia))}
          {tipo ? ` · ${tipoLabel(tipo)}` : ''}.
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[color:var(--color-line)] bg-[color:var(--color-panel)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Competência</th>
                  <th className="px-4 py-3">Resumo</th>
                  <th className="px-4 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[color:var(--color-line)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[color:var(--color-ink)]">
                        {row.empresa_alias || row.empresa_razao || '—'}
                      </div>
                      {row.empresa_alias && row.empresa_razao ? (
                        <div className="mt-0.5 text-xs text-[color:var(--color-muted)]">
                          {row.empresa_razao}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-muted)]">
                      {formatCnpj(row.empresa_cnpj)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="glass-chip">{tipoLabel(row.tipo)}</span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-muted)]">
                      {formatCompetencia(row.competencia)}
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-[color:var(--color-ink)]">
                      {resumoPayload(row)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[color:var(--color-muted)]">
                      {row.updated_at
                        ? new Date(row.updated_at).toLocaleString('pt-BR')
                        : row.created_at
                          ? new Date(row.created_at).toLocaleString('pt-BR')
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
