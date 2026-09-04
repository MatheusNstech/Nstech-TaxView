import { Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Responsavel } from '../types'

const emptyForm = { nome: '', email: '', ativo: true, capacidade_max: '' }

export default function Responsaveis() {
  const [items, setItems] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await apiFetch<Responsavel[]>('/api/responsaveis'))
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
      const payload = {
        nome: form.nome,
        email: form.email || null,
        ativo: form.ativo,
        capacidade_max: form.capacidade_max
          ? Number(form.capacidade_max)
          : null,
      }
      if (editingId) {
        await apiFetch(`/api/responsaveis/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/responsaveis', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      resetForm()
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  const startEdit = (item: Responsavel) => {
    setEditingId(item.id)
    setForm({
      nome: item.nome,
      email: item.email ?? '',
      ativo: item.ativo,
      capacidade_max:
        item.capacidade_max != null ? String(item.capacidade_max) : '',
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este responsável?')) return
    try {
      await apiFetch(`/api/responsaveis/${id}`, { method: 'DELETE' })
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
          <Users className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Responsáveis
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Equipe responsável pelas entregas fiscais
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="glass-panel p-5">
        <h3 className="mb-4 text-sm font-semibold text-[color:var(--color-ink)]">
          {editingId ? 'Editar responsável' : 'Novo responsável'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="glass-input"
          />
          <input
            type="email"
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="glass-input"
          />
          <input
            type="number"
            min={1}
            placeholder="Capacidade máx. (opcional)"
            value={form.capacidade_max}
            onChange={(e) => setForm({ ...form, capacidade_max: e.target.value })}
            className="glass-input"
          />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[color:var(--color-muted)]">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="rounded border-[color:var(--color-line)] text-brand-600 focus:ring-brand-500"
            />
            Ativo
          </label>
          <div className="ml-auto flex gap-2">
            {editingId && (
              <button type="button" onClick={resetForm} className="btn-ghost">
                <X className="h-4 w-4" strokeWidth={1.75} />
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
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Capacidade</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-line)]">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[color:var(--color-muted)]">
                  Carregando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[color:var(--color-muted)]">
                  Nenhum responsável cadastrado
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-brand-500/10">
                  <td className="px-5 py-3 font-medium text-[color:var(--color-ink)]">
                    {item.nome}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">
                    {item.email ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-[color:var(--color-muted)]">
                    {item.capacidade_max ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${item.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {item.ativo ? 'Ativo' : 'Inativo'}
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
