import {
  Briefcase,
  Plus,
  Shield,
  UserCog,
  UserRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiFetch } from '../lib/api'
import type { Responsavel, Usuario, UsuarioCreate, UsuarioRole } from '../types'

const emptyForm: UsuarioCreate = {
  email: '',
  password: '',
  nome: '',
  role: 'user',
  responsavel_id: '',
}

export default function Usuarios() {
  const [items, setItems] = useState<Usuario[]>([])
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setActionError('')
    try {
      const [users, resps] = await Promise.all([
        apiFetch<Usuario[]>('/api/usuarios'),
        apiFetch<Responsavel[]>('/api/responsaveis'),
      ])
      setItems(users)
      setResponsaveis(resps.filter((r) => r.ativo))
    } catch (err) {
      setItems([])
      setActionError(
        err instanceof Error ? err.message : 'Erro ao carregar usuários',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const disponiveis = useMemo(
    () => responsaveis.filter((r) => !r.auth_user_id),
    [responsaveis],
  )

  const openCreate = () => {
    setForm(emptyForm)
    setError('')
    setDrawerOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Informe e-mail e senha')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: UsuarioCreate = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role ?? 'user',
        nome: form.nome?.trim() || undefined,
        responsavel_id: form.responsavel_id || undefined,
      }
      await apiFetch<Usuario>('/api/usuarios', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setDrawerOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setSaving(false)
    }
  }

  const patchUser = async (
    id: string,
    body: { role?: UsuarioRole; ativo?: boolean },
  ) => {
    setActionError('')
    try {
      await apiFetch<Usuario>(`/api/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await load()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Erro ao atualizar usuário',
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <UserCog className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
              Usuários
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              Cadastro de logins (somente admin)
            </p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Novo usuário
        </button>
      </div>

      {actionError && (
        <p className="rounded-xl bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </p>
      )}

      <div className="card-surface overflow-hidden">
        {loading ? (
          <p className="px-5 py-10 text-center text-[color:var(--color-muted)]">
            Carregando...
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Papel</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-line)]">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-[color:var(--color-muted)]"
                  >
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="hover:bg-brand-500/10">
                    <td className="px-5 py-3 font-medium">{u.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          u.role === 'admin'
                            ? 'bg-brand-50 text-brand-700'
                            : u.role === 'diretor'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-700',
                        ].join(' ')}
                      >
                        {u.role === 'admin' ? (
                          <Shield className="h-3 w-3" strokeWidth={2} />
                        ) : u.role === 'diretor' ? (
                          <Briefcase className="h-3 w-3" strokeWidth={2} />
                        ) : (
                          <UserRound className="h-3 w-3" strokeWidth={2} />
                        )}
                        {u.role === 'admin'
                          ? 'Admin'
                          : u.role === 'diretor'
                            ? 'Diretor'
                            : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          u.ativo
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                            : 'rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700'
                        }
                      >
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>
                    <td className="space-x-2 px-5 py-3 text-right">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => void patchUser(u.id, { role: 'admin' })}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Tornar admin
                        </button>
                      )}
                      {u.role !== 'diretor' && (
                        <button
                          type="button"
                          onClick={() =>
                            void patchUser(u.id, { role: 'diretor' })
                          }
                          className="text-xs font-medium text-amber-800 hover:underline"
                        >
                          Tornar diretor
                        </button>
                      )}
                      {(u.role === 'admin' || u.role === 'diretor') && (
                        <button
                          type="button"
                          onClick={() => void patchUser(u.id, { role: 'user' })}
                          className="text-xs font-medium text-[color:var(--color-muted)] hover:underline"
                        >
                          Tornar usuário
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void patchUser(u.id, { ativo: !u.ativo })
                        }
                        className={[
                          'text-xs font-medium hover:underline',
                          u.ativo ? 'text-rose-600' : 'text-emerald-700',
                        ].join(' ')}
                      >
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
                Novo usuário
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
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="glass-input"
                    placeholder="pessoa@nstech.com.br"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="glass-input"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Nome (opcional)
                  </label>
                  <input
                    value={form.nome ?? ''}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="glass-input"
                    placeholder="Nome de exibição"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Papel
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as UsuarioRole,
                      })
                    }
                    className="glass-input"
                  >
                    <option value="user">Usuário</option>
                    <option value="diretor">Diretor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                    Vincular responsável (opcional)
                  </label>
                  <select
                    value={form.responsavel_id ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, responsavel_id: e.target.value })
                    }
                    className="glass-input"
                  >
                    <option value="">Nenhum</option>
                    {disponiveis.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                </div>
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
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Criando...' : 'Criar login'}
                </button>
              </footer>
            </form>
          </aside>
        </>
      )}
    </div>
  )
}
