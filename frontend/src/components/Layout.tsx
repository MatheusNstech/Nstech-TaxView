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
import { useEffect, useState } from 'react'
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

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return narrow
}

function NavItemLink({
  item,
  expanded,
  onSelect,
}: {
  item: NavItem
  expanded: boolean
  onSelect: () => void
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      onClick={onSelect}
      className={({ isActive }) =>
        [
          'glass-nav-item',
          expanded ? '' : 'sidebar-icon-only',
          isActive ? 'glass-nav-item-active' : '',
        ].join(' ')
      }
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span
        className={[
          'whitespace-nowrap transition-opacity duration-200',
          expanded ? 'opacity-100' : 'hidden',
        ].join(' ')}
      >
        {item.label}
      </span>
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
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const isNarrow = useIsNarrow()
  const expanded = isNarrow ? pinned : hovered || focused

  useEffect(() => {
    if (!isNarrow) setPinned(false)
  }, [isNarrow])

  useEffect(() => {
    if (isNarrow) setPinned(false)
  }, [location.pathname, isNarrow])

  const closeIfNarrow = () => {
    if (isNarrow) setPinned(false)
  }

  const visibleNav = isAdmin
    ? adminMainNav
    : otherNav.filter((item) => {
        if (item.diretorOnly && !isDiretor) return false
        if (item.hideForDiretor && isDiretor) return false
        return true
      })

  return (
    <div className="mesh-bg flex min-h-screen">
      <div
        className={[
          'sticky top-3 z-40 m-3 h-[calc(100vh-1.5rem)] shrink-0',
          isNarrow ? 'w-[4.5rem]' : 'sidebar-rail',
          !isNarrow && (expanded ? 'w-64' : 'w-[4.5rem]'),
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <aside
          className={[
            'glass-panel flex h-full flex-col overflow-hidden',
            isNarrow
              ? [
                  'sidebar-rail absolute inset-y-0 left-0',
                  expanded ? 'w-64 shadow-xl' : 'w-[4.5rem]',
                ].join(' ')
              : 'relative w-full',
          ].join(' ')}
          onMouseEnter={() => {
            if (!isNarrow) setHovered(true)
          }}
          onMouseLeave={() => {
            setHovered(false)
            if (isNarrow) setPinned(false)
          }}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            const next = event.relatedTarget
            if (next instanceof Node && event.currentTarget.contains(next)) return
            setFocused(false)
          }}
        >
        <div className={['border-b border-[color:var(--color-line)]', expanded ? 'px-4 py-5' : 'px-2 py-4'].join(' ')}>
          <div className="flex flex-col items-center gap-3 text-center">
            {isNarrow && !expanded ? (
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-[color:var(--color-panel)]"
                aria-label="Abrir menu"
                aria-expanded={expanded}
                onClick={() => setPinned(true)}
              >
                <img
                  src="/nstech-logo.png"
                  alt=""
                  className="h-7 w-10 object-contain object-left"
                />
              </button>
            ) : (
              <a
                href="https://nstech.com.br/?scLang=pt-BR"
                target="_blank"
                rel="noopener noreferrer"
                className={[
                  'overflow-hidden bg-white transition dark:bg-[color:var(--color-panel)]',
                  expanded ? 'rounded-full px-4 py-2' : 'flex h-10 w-10 items-center justify-center rounded-xl',
                ].join(' ')}
                aria-label="Site nstech"
              >
                <img
                  src="/nstech-logo.png"
                  alt="nstech"
                  className={
                    expanded
                      ? 'h-9 w-auto max-w-[11.5rem] object-contain'
                      : 'h-7 w-10 object-contain object-left'
                  }
                />
              </a>
            )}
            {expanded && (
              <div className="min-w-0 px-1">
                <p className="text-sm font-semibold leading-tight text-[color:var(--color-ink)]">
                  TaxView
                </p>
                {isDiretor && (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    Visão - Tax
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <nav className={['min-h-0 flex-1 space-y-1 overflow-y-auto py-4', expanded ? 'px-3' : 'px-2'].join(' ')}>
          {visibleNav.map((item) => (
            <NavItemLink key={item.to} item={item} expanded={expanded} onSelect={closeIfNarrow} />
          ))}

          {isAdmin && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!expanded && isNarrow) {
                    setPinned(true)
                    setConfigOpen(true)
                    return
                  }
                  setConfigOpen((open) => !open)
                }}
                title="Configurações"
                aria-label="Configurações"
                className={[
                  'glass-nav-item w-full',
                  expanded ? '' : 'sidebar-icon-only',
                  configActive && !configOpen ? 'glass-nav-item-active' : '',
                ].join(' ')}
                aria-expanded={expanded && configOpen}
              >
                <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span
                  className={[
                    'flex-1 whitespace-nowrap text-left transition-opacity duration-200',
                    expanded ? 'opacity-100' : 'hidden',
                  ].join(' ')}
                >
                  Configurações
                </span>
                {expanded && (
                  <ChevronDown
                    className={[
                      'h-4 w-4 shrink-0 transition-transform',
                      configOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    strokeWidth={1.75}
                  />
                )}
              </button>
              {expanded && configOpen && (
                <div className="mt-1 space-y-1 border-l border-[color:var(--color-line)] pl-3">
                  {adminConfigNav.map((item) => (
                    <NavItemLink
                      key={item.to}
                      item={item}
                      expanded={expanded}
                      onSelect={closeIfNarrow}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={['border-t border-[color:var(--color-line)]', expanded ? 'p-4' : 'p-2'].join(' ')}>
          <div className={['mb-3 flex items-center gap-2', expanded ? 'justify-between' : 'justify-center'].join(' ')}>
            {expanded && (
              <p className="truncate text-xs text-[color:var(--color-muted)]">
                {session?.user.email}
              </p>
            )}
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            title="Sair"
            aria-label="Sair"
            className={['btn-ghost w-full', expanded ? '' : 'justify-center'].join(' ')}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span
              className={[
                'whitespace-nowrap transition-opacity duration-200',
                expanded ? 'opacity-100' : 'hidden',
              ].join(' ')}
            >
              Sair
            </span>
          </button>
        </div>
        </aside>
      </div>

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-8 pr-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
