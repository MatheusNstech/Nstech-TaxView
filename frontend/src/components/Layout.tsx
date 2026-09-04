import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Upload,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

const navItems: {
  to: string
  label: string
  end: boolean
  icon: LucideIcon
  adminOnly?: boolean
  diretorOnly?: boolean
  hideForDiretor?: boolean
}[] = [
  { to: '/diretoria', label: 'Visão - Tax', end: true, icon: BriefcaseBusiness, diretorOnly: true },
  { to: '/diretoria/fechamento', label: 'Fechamento', end: false, icon: CalendarCheck, diretorOnly: true },
  { to: '/diretoria/pendencias', label: 'Pendências', end: false, icon: AlertTriangle, diretorOnly: true },
  { to: '/', label: 'Analytics', end: true, icon: LayoutDashboard, hideForDiretor: true },
  { to: '/minhas-tarefas', label: 'Minhas tarefas', end: false, icon: ListTodo, hideForDiretor: true },
  { to: '/calendario', label: 'Calendário', end: false, icon: CalendarDays },
  { to: '/obrigacoes', label: 'Obrigações', end: false, icon: ListChecks, hideForDiretor: true },
  { to: '/empresas', label: 'Empresas', end: false, icon: Building2, adminOnly: true },
  { to: '/atividades', label: 'Atividades', end: false, icon: ClipboardList, adminOnly: true },
  { to: '/responsaveis', label: 'Responsáveis', end: false, icon: Users, adminOnly: true },
  { to: '/usuarios', label: 'Usuários', end: false, icon: UserCog, adminOnly: true },
  { to: '/importacao', label: 'Importação', end: false, icon: Upload, adminOnly: true },
]

export default function Layout() {
  const { signOut, session, isAdmin, isDiretor } = useAuth()
  const visibleNav = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    if (item.diretorOnly && !isDiretor && !isAdmin) return false
    if (item.hideForDiretor && isDiretor) return false
    return true
  })

  return (
    <div className="mesh-bg flex min-h-screen">
      <aside className="glass-panel sticky top-3 m-3 flex h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col">
        <div className="border-b border-[color:var(--color-line)] px-4 py-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <img
              src="/nstech-logo.png"
              alt="nstech"
              className="h-12 w-36 rounded-full object-cover shadow-md shadow-brand-500/30 ring-1 ring-white/70"
            />
            <div className="min-w-0 px-1">
              <p className="text-sm font-semibold leading-tight text-[color:var(--color-ink)]">
                Nstax - Cronograma
              </p>
              {isDiretor && (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Visão - Tax
                </p>
              )}
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  ['glass-nav-item', isActive ? 'glass-nav-item-active' : ''].join(' ')
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-[color:var(--color-line)] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-[color:var(--color-muted)]">
              {session?.user.email}
            </p>
            <ThemeToggle />
          </div>
          <button type="button" onClick={() => void signOut()} className="btn-ghost w-full">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-8 pr-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
