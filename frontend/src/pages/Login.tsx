import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'
import { AuthSkeleton } from '../components/ui/PageSkeletons'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, loading, signIn, mustChangePassword, recoveryPending, homePath } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return <AuthSkeleton />
  }

  if (session) {
    if (recoveryPending) {
      return <Navigate to="/esqueci-senha" replace />
    }
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
          <a
            href="https://nstech.com.br/?scLang=pt-BR"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 rounded-full bg-white px-5 py-2.5 transition dark:bg-[color:var(--color-panel)]"
            aria-label="Site nstech"
          >
            <img
              src="/nstech-logo.png"
              alt="nstech"
              className="h-12 w-auto max-w-[15rem] object-contain"
            />
          </a>
          <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">
            TaxView
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
              <div className="mt-2 text-right">
                <Link
                  to="/esqueci-senha"
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  Esqueci minha senha
                </Link>
              </div>
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
