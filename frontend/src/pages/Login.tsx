import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
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
    <div className="relative min-h-screen">
      <img
        src="/wallpaper-tns.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[right_center]"
      />
      <div className="relative flex min-h-screen items-center px-6 py-10 sm:px-12 lg:w-[42%] lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Faça seu login.
          </h1>
          <p className="mt-2 text-sm text-white/55">TaxView</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-10 space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/70">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm text-white/70">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <div className="mt-3 text-right">
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-white/55 transition hover:text-white"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            {error && (
              <p className="rounded-2xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full rounded-full py-3"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
