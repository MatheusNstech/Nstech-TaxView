import { Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function TrocarSenha() {
  const { session, loading, mustChangePassword, changePassword, refreshMe, signOut, homePath } =
    useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="mesh-bg flex min-h-screen items-center justify-center">
        <div className="skeleton h-10 w-40" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!mustChangePassword) {
    return <Navigate to={homePath} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 12) {
      setError('A senha deve ter ao menos 12 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }
    if (password === 'Senha@123') {
      setError('Escolha uma senha diferente da padrão')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await changePassword(password)
      await refreshMe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao trocar senha')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mesh-bg relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="glass-panel w-full max-w-md p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <Lock className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[color:var(--color-ink)]">
              Trocar senha
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              No primeiro acesso, defina uma senha nova
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Nova senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input py-2.5"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Confirmar senha
            </label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="glass-input py-2.5"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
          {submitting ? 'Salvando...' : 'Salvar nova senha'}
        </button>
        <button
          type="button"
          className="btn-ghost mt-3 w-full"
          onClick={() => void signOut()}
        >
          Sair
        </button>
      </form>
    </div>
  )
}
