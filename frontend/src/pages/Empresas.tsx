import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { TableSkeleton } from '../components/ui/PageSkeletons'
import { apiFetch } from '../lib/api'
import type { Empresa } from '../types'

const emptyForm = { cnpj: '', razao_social: '', bu: '', ativa: true }

export default function Empresas() {
  const [items, setItems] = useState<Empresa[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await apiFetch<Empresa[]>('/api/empresas'))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editingId) {
        await apiFetch(`/api/empresas/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
      } else {
        await apiFetch('/api/empresas', {
          method: 'POST',
          body: JSON.stringify(form),
        })
      }
      resetForm()
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  const startEdit = (item: Empresa) => {
    setEditingId(item.id)
    setForm({
      cnpj: item.cnpj,
      razao_social: item.razao_social,
      bu: item.bu,
      ativa: item.ativa,
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta empresa?')) return
    try {
      await apiFetch(`/api/empresas/${id}`, { method: 'DELETE' })
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
          <Building2 className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Empresas
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Cadastro de empresas do grupo
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="glass-panel p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--color-ink)]">
          {editingId ? 'Editar empresa' : 'Nova empresa'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            required
            placeholder="CNPJ"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            className="glass-input"
          />
          <input
            required
            placeholder="Razão social"
            value={form.razao_social}
            onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
            className="glass-input sm:col-span-2"
          />
          <input
            required
            placeholder="BU"
            value={form.bu}
            onChange={(e) => setForm({ ...form, bu: e.target.value })}
            className="glass-input"
          />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-muted)]">
            <input
              type="checkbox"
              checked={form.ativa}
              onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
              className="rounded border-[color:var(--color-line)] text-brand-600 focus:ring-brand-500"
            />
            Ativa
          </label>
          <div className="ml-auto flex gap-2">
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-ghost">
                Cancelar
              </button>
            )}
            <button type="submit" className="btn-primary">
              {editingId ? (
                <>
                  <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  Atualizar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </form>

      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
              <th className="px-5 py-3">CNPJ</th>
              <th className="px-5 py-3">Razão social</th>
              <th className="px-5 py-3">BU</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-line)]">
            {loading ? (
              <TableSkeleton asRows rows={6} cols={5} />
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[color:var(--color-muted)]">
                  Nenhuma empresa cadastrada
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-brand-500/10">
                  <td className="px-5 py-3 font-mono text-xs text-[color:var(--color-muted)]">
                    {item.cnpj}
                  </td>
                  <td className="px-5 py-3 font-medium text-[color:var(--color-ink)]">
                    {item.razao_social}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">{item.bu}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.ativa ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {item.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="space-x-2 px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={1.75} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
