import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Settings,
  Upload,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

type NavItem = {
  to: string
  label: string
  end: boolean
  icon: LucideIcon
  adminOnly?: boolean
  diretorOnly?: boolean
  hideForDiretor?: boolean
}

const adminMainNav: NavItem[] = [
  { to: '/diretoria', label: 'Visão Tax', end: true, icon: BriefcaseBusiness },
  { to: '/', label: 'Analytics', end: true, icon: LayoutDashboard },
  { to: '/diretoria/pendencias', label: 'Pendências', end: false, icon: AlertTriangle },
  { to: '/diretoria/fechamento', label: 'Fechamento', end: false, icon: CalendarCheck },
  { to: '/minhas-tarefas', label: 'Minhas tarefas', end: false, icon: ListTodo },
  { to: '/calendario', label: 'Calendário', end: false, icon: CalendarDays },
]

const adminConfigNav: NavItem[] = [
  { to: '/obrigacoes', label: 'Obrigações', end: false, icon: ListChecks },
  { to: '/empresas', label: 'Empresas', end: false, icon: Building2 },
  { to: '/atividades', label: 'Atividades', end: false, icon: ClipboardList },
  { to: '/responsaveis', label: 'Responsáveis', end: false, icon: Users },
  { to: '/usuarios', label: 'Usuários', end: false, icon: UserCog },
  { to: '/importacao', label: 'Importação', end: false, icon: Upload },
]

const otherNav: NavItem[] = [
  { to: '/diretoria', label: 'Visão Tax', end: true, icon: BriefcaseBusiness, diretorOnly: true },
  { to: '/diretoria/pendencias', label: 'Pendências', end: false, icon: AlertTriangle, diretorOnly: true },
  { to: '/diretoria/fechamento', label: 'Fechamento', end: false, icon: CalendarCheck, diretorOnly: true },
  { to: '/', label: 'Analytics', end: true, icon: LayoutDashboard, hideForDiretor: true },
  { to: '/minhas-tarefas', label: 'Minhas tarefas', end: false, icon: ListTodo, hideForDiretor: true },
  { to: '/calendario', label: 'Calendário', end: false, icon: CalendarDays },
  { to: '/obrigacoes', label: 'Obrigações', end: false, icon: ListChecks, hideForDiretor: true },
]

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        ['glass-nav-item', isActive ? 'glass-nav-item-active' : ''].join(' ')
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { signOut, session, isAdmin, isDiretor } = useAuth()
  const location = useLocation()
  const configActive = adminConfigNav.some((item) =>
    location.pathname.startsWith(item.to),
  )
  const [configOpen, setConfigOpen] = useState(configActive)

  const visibleNav = isAdmin
    ? adminMainNav
    : otherNav.filter((item) => {
        if (item.diretorOnly && !isDiretor) return false
        if (item.hideForDiretor && isDiretor) return false
        return true
      })

  return (
    <div className="mesh-bg flex min-h-screen">
      <aside className="glass-panel sticky top-3 m-3 flex h-[calc(100vh-1.5rem)] w-64 shrink-0 flex-col">
        <div className="border-b border-[color:var(--color-line)] px-4 py-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <a
              href="https://nstech.com.br/?scLang=pt-BR"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-white px-4 py-2 transition dark:bg-[color:var(--color-panel)]"
              aria-label="Site nstech"
            >
              <img
                src="/nstech-logo.png"
                alt="nstech"
                className="h-9 w-auto max-w-[11.5rem] object-contain"
              />
            </a>
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
          {visibleNav.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}

          {isAdmin && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfigOpen((open) => !open)}
                className={[
                  'glass-nav-item w-full',
                  configActive && !configOpen ? 'glass-nav-item-active' : '',
                ].join(' ')}
                aria-expanded={configOpen}
              >
                <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 text-left">Configurações</span>
                <ChevronDown
                  className={[
                    'h-4 w-4 shrink-0 transition-transform',
                    configOpen ? 'rotate-180' : '',
                  ].join(' ')}
                  strokeWidth={1.75}
                />
              </button>
              {configOpen && (
                <div className="mt-1 space-y-1 border-l border-[color:var(--color-line)] pl-3">
                  {adminConfigNav.map((item) => (
                    <NavItemLink key={item.to} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
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
