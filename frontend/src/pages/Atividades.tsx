import {
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch } from '../lib/api'
import type { Atividade } from '../types'

const emptyForm = {
  nome: '',
  requer_apuracao: true,
  dia_prazo_legal: '',
  dia_prazo_fiscal: '',
  recorrencia: 'mensal',
  ativa: true,
}

export default function Atividades() {
  const [items, setItems] = useState<Atividade[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await apiFetch<Atividade[]>('/api/atividades'))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
    setDrawerOpen(true)
  }

  const openEdit = (item: Atividade) => {
    setForm({
      nome: item.nome,
      requer_apuracao: item.requer_apuracao,
      dia_prazo_legal: item.dia_prazo_legal?.toString() ?? '',
      dia_prazo_fiscal: item.dia_prazo_fiscal?.toString() ?? '',
      recorrencia: item.recorrencia,
      ativa: item.ativa,
    })
    setEditingId(item.id)
    setError('')
    setDrawerOpen(true)
  }

  const toPayload = () => ({
    nome: form.nome.trim(),
    requer_apuracao: form.requer_apuracao,
    dia_prazo_legal: form.dia_prazo_legal ? Number(form.dia_prazo_legal) : null,
    dia_prazo_fiscal: form.dia_prazo_fiscal ? Number(form.dia_prazo_fiscal) : null,
    recorrencia: form.recorrencia,
    ativa: form.ativa,
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      setError('Informe o nome da atividade')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await apiFetch(`/api/atividades/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(toPayload()),
        })
      } else {
        await apiFetch('/api/atividades', {
          method: 'POST',
          body: JSON.stringify(toPayload()),
        })
      }
      setDrawerOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta atividade?')) return
    try {
      await apiFetch(`/api/atividades/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <ClipboardList className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
              Atividades
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              Modelos de obrigação com prazos e recorrência
            </p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Nova atividade
        </button>
      </div>

      <div className="card-surface overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} framed={false} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Prazos</th>
                <th className="px-5 py-3">Recorrência</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-brand-500/10">
                  <td className="px-5 py-3 font-medium">{item.nome}</td>
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">
                    Legal {item.dia_prazo_legal ?? '—'} · Fiscal{' '}
                    {item.dia_prazo_fiscal ?? '—'}
                  </td>
                  <td className="px-5 py-3 capitalize">{item.recorrencia}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        item.ativa
                          ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                      }
                    >
                      {item.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="space-x-2 px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[color:var(--color-ink)]/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="glass-panel fixed inset-y-3 right-3 z-50 flex w-full max-w-md flex-col !rounded-3xl shadow-2xl">
            <header className="flex items-center justify-between border-b border-[color:var(--color-line)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
                {editingId ? 'Editar atividade' : 'Nova atividade'}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="btn-ghost !p-2"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="flex flex-1 flex-col"
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Nome
                  </label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="glass-input"
                    placeholder="Ex.: Apuração ISS Prestados"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                      Dia prazo legal
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dia_prazo_legal}
                      onChange={(e) =>
                        setForm({ ...form, dia_prazo_legal: e.target.value })
                      }
                      className="glass-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                      Dia prazo fiscal
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dia_prazo_fiscal}
                      onChange={(e) =>
                        setForm({ ...form, dia_prazo_fiscal: e.target.value })
                      }
                      className="glass-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Recorrência
                  </label>
                  <select
                    value={form.recorrencia}
                    onChange={(e) =>
                      setForm({ ...form, recorrencia: e.target.value })
                    }
                    className="glass-input"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={form.requer_apuracao}
                    onChange={(e) =>
                      setForm({ ...form, requer_apuracao: e.target.checked })
                    }
                  />
                  Requer apuração
                </label>
                <label className="flex items-center gap-2 text-sm text-[color:var(--color-ink)]">
                  <input
                    type="checkbox"
                    checked={form.ativa}
                    onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
                  />
                  Ativa
                </label>
                {error && (
                  <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                )}
              </div>
              <footer className="flex gap-3 border-t border-[color:var(--color-line)] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="btn-ghost flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
                </button>
              </footer>
            </form>
          </aside>
        </>
      )}
    </div>
  )
}
