import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiFetch } from '../../lib/api'
import type { AreaContato, EmpresaGrupo, EmpresaUnidade, PorteEmpresa } from '../../types'

const PORTES: PorteEmpresa[] = ['Pequeno', 'Médio', 'Grande']

interface Props {
  grupo: EmpresaGrupo | null
  onClose: () => void
  onSaved: () => void
}

function valoresDa(unidade: EmpresaUnidade, area: AreaContato): string[] {
  return unidade.contatos
    .filter((c) => c.area === area)
    .map((c) => (area === 'contabil' ? c.nome : c.email) ?? '')
    .filter(Boolean)
}

function ListaEditavel({
  label,
  placeholder,
  type,
  values,
  onChange,
  disabled,
}: {
  label: string
  placeholder: string
  type: 'text' | 'email'
  values: string[]
  onChange: (values: string[]) => void
  disabled: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-[color:var(--color-muted)]">{label}</label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          onClick={() => onChange([...values, ''])}
          disabled={disabled || values.length >= 20}
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Adicionar
        </button>
      </div>
      {values.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[color:var(--color-line)] px-3 py-2 text-xs text-[color:var(--color-muted)]">
          Nenhum cadastrado
        </p>
      ) : (
        <div className="space-y-1.5">
          {values.map((v, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                type={type}
                value={v}
                placeholder={placeholder}
                onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
                className="glass-input"
                disabled={disabled}
              />
              <button
                type="button"
                className="btn-ghost !p-2"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                aria-label="Remover"
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-600" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EmpresaEditModal({ grupo, onClose, onSaved }: Props) {
  const unidades = useMemo(() => (grupo ? [grupo.matriz, ...grupo.filiais] : []), [grupo])
  const [unidadeId, setUnidadeId] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [porte, setPorte] = useState<PorteEmpresa | ''>('')
  const [contabil, setContabil] = useState<string[]>([])
  const [emails, setEmails] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unidade = unidades.find((u) => u.id === unidadeId) ?? unidades[0]

  useEffect(() => {
    setUnidadeId(grupo?.matriz.id ?? '')
  }, [grupo])

  useEffect(() => {
    if (!unidade) return
    setNomeFantasia(unidade.nome_fantasia ?? '')
    setPorte(PORTES.includes(unidade.porte as PorteEmpresa) ? (unidade.porte as PorteEmpresa) : '')
    setContabil(valoresDa(unidade, 'contabil'))
    setEmails(valoresDa(unidade, 'contas_pagar'))
    setError('')
  }, [unidade])

  if (!grupo || !unidade) return null

  const herdando = !unidade.matriz && unidade.contatos.length === 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const limpa = (lista: string[]) => lista.map((v) => v.trim()).filter(Boolean)
      await apiFetch(`/api/empresas/${unidade.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome_fantasia: nomeFantasia.trim() || null, porte: porte || null }),
      })
      await apiFetch(`/api/empresas/${unidade.id}/contatos`, {
        method: 'PUT',
        body: JSON.stringify({ area: 'contabil', contatos: limpa(contabil).map((nome) => ({ nome })) }),
      })
      await apiFetch(`/api/empresas/${unidade.id}/contatos`, {
        method: 'PUT',
        body: JSON.stringify({
          area: 'contas_pagar',
          contatos: limpa(emails).map((email) => ({ email })),
        }),
      })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
        disabled={saving}
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-[1.25rem] border border-[color:var(--color-line)] bg-white shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[color:var(--color-line)] p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">Editar {grupo.nome}</h2>
            <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
              Responsáveis contábil e de contas a pagar
            </p>
          </div>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {unidades.length > 1 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">CNPJ</label>
              <select
                value={unidade.id}
                onChange={(e) => setUnidadeId(e.target.value)}
                className="glass-input"
                disabled={saving}
              >
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.cnpj} — {u.matriz ? 'Matriz' : 'Filial'} ({u.bu})
                  </option>
                ))}
              </select>
              {herdando && (
                <p className="mt-1 text-[11px] text-[color:var(--color-muted)]">
                  Esta filial não tem contatos próprios e usa os da matriz. Preencha só se forem diferentes.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Nome fantasia
              </label>
              <input
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder={unidade.razao_social}
                className="glass-input"
                maxLength={120}
                disabled={saving}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">Porte</label>
              <select
                value={porte}
                onChange={(e) => setPorte(e.target.value as PorteEmpresa | '')}
                className="glass-input"
                disabled={saving}
              >
                <option value="">—</option>
                {PORTES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ListaEditavel
            label="Responsável contábil"
            placeholder="Nome"
            type="text"
            values={contabil}
            onChange={setContabil}
            disabled={saving}
          />
          <ListaEditavel
            label="E-mails de contas a pagar"
            placeholder="nome@nstech.com.br"
            type="email"
            values={emails}
            onChange={setEmails}
            disabled={saving}
          />

          {error && <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[color:var(--color-line)] p-4">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
