import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, loading, signIn, mustChangePassword, homePath } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="mesh-bg flex min-h-screen items-center justify-center">
        <div className="skeleton h-10 w-40" />
      </div>
    )
  }

  if (session) {
    return (
      <Navigate
        to={mustChangePassword ? '/trocar-senha' : homePath}
        replace
      />
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mesh-bg relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/nstech-logo.png"
            alt="nstech"
            className="mb-4 h-14 w-44 rounded-full object-cover shadow-lg shadow-brand-500/30 ring-1 ring-[color:var(--glass-border)]"
          />
          <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">
            Nstax - Cronograma
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Cronograma Fiscal Inteligente
          </p>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="glass-panel p-8"
        >
          <h2 className="mb-6 text-lg font-semibold text-[color:var(--color-ink)]">
            Entrar
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted)]">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input py-2.5"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted)]">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input py-2.5"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
            {submitting ? 'Entrando...' : 'Acessar'}
          </button>
        </form>
      </div>
    </div>
  )
}
