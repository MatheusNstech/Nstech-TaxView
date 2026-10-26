import {
  AlertTriangle,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Gavel,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Scale,
  Settings,
  Upload,
  UserCog,
  Users,
  Wallet,
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
  painelFiscal?: boolean
}

const adminMainNav: NavItem[] = [
  { to: '/empresas', label: 'Empresas', end: false, icon: Building2 },
]

/** Submenu Dashboards: Visão Tax + Analytics. */
const dashboardsNav: NavItem[] = [
  {
    to: '/diretoria',
    label: 'Visão Tax',
    end: true,
    icon: BriefcaseBusiness,
    diretorOnly: true,
  },
  {
    to: '/',
    label: 'Analytics',
    end: true,
    icon: LayoutDashboard,
    hideForDiretor: true,
  },
]

/** Submenu Contencioso: RFB/PGFN + PER/DCOMP. */
const contenciosoNav: NavItem[] = [
  {
    to: '/diretoria/pendencias-rfb',
    label: 'RFB / PGFN',
    end: false,
    icon: FileWarning,
    painelFiscal: true,
  },
  {
    to: '/diretoria/perdcomp',
    label: 'PER/DCOMP',
    end: false,
    icon: Scale,
    painelFiscal: true,
  },
]

/** Submenu Tarefas: Minhas tarefas, Pendências, Fechamento, Calendário. */
const tarefasNav: NavItem[] = [
  {
    to: '/minhas-tarefas',
    label: 'Minhas tarefas',
    end: false,
    icon: ListTodo,
    hideForDiretor: true,
  },
  {
    to: '/diretoria/pendencias',
    label: 'Pendências',
    end: false,
    icon: AlertTriangle,
    diretorOnly: true,
  },
  {
    to: '/diretoria/fechamento',
    label: 'Fechamento',
    end: false,
    icon: CalendarCheck,
    diretorOnly: true,
  },
  { to: '/calendario', label: 'Calendário', end: false, icon: CalendarDays },
]

/** Submenu Valores: Créditos + Impostos (ex-Valores). */
const valoresNav: NavItem[] = [
  {
    to: '/diretoria/creditos',
    label: 'Créditos',
    end: false,
    icon: Wallet,
    painelFiscal: true,
  },
  {
    to: '/diretoria/valores',
    label: 'Impostos',
    end: false,
    icon: CircleDollarSign,
    diretorOnly: true,
  },
]

const adminConfigNav: NavItem[] = [
  { to: '/obrigacoes', label: 'Obrigações', end: false, icon: ListChecks },
  { to: '/cadastro-empresas', label: 'Cadastro de empresas', end: false, icon: Building },
  { to: '/atividades', label: 'Atividades', end: false, icon: ClipboardList },
  { to: '/responsaveis', label: 'Responsáveis', end: false, icon: Users },
  { to: '/usuarios', label: 'Usuários', end: false, icon: UserCog },
  { to: '/importacao', label: 'Importação', end: false, icon: Upload },
]

const otherNav: NavItem[] = [
  { to: '/obrigacoes', label: 'Obrigações', end: false, icon: ListChecks, hideForDiretor: true },
  { to: '/empresas', label: 'Empresas', end: false, icon: Building2 },
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

function NavSubmenu({
  label,
  icon: Icon,
  items,
  open,
  setOpen,
  active,
  expanded,
  isNarrow,
  onExpandNarrow,
  onSelect,
}: {
  label: string
  icon: LucideIcon
  items: NavItem[]
  open: boolean
  setOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  active: boolean
  expanded: boolean
  isNarrow: boolean
  onExpandNarrow: () => void
  onSelect: () => void
}) {
  if (!items.length) return null

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => {
          if (!expanded && isNarrow) {
            onExpandNarrow()
            setOpen(true)
            return
          }
          setOpen((v) => !v)
        }}
        title={label}
        aria-label={label}
        className={[
          'glass-nav-item w-full',
          expanded ? '' : 'sidebar-icon-only',
          active && !open ? 'glass-nav-item-active' : '',
        ].join(' ')}
        aria-expanded={expanded && open}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span
          className={[
            'flex-1 whitespace-nowrap text-left transition-opacity duration-200',
            expanded ? 'opacity-100' : 'hidden',
          ].join(' ')}
        >
          {label}
        </span>
        {expanded && (
          <ChevronDown
            className={[
              'h-4 w-4 shrink-0 transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
            strokeWidth={1.75}
          />
        )}
      </button>
      {expanded && open && (
        <div className="mt-1 space-y-1 border-l border-[color:var(--color-line)] pl-3">
          {items.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              expanded={expanded}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function filterNavItem(
  item: NavItem,
  opts: { isDiretor: boolean; canReadPainelFiscal: boolean },
): boolean {
  if (item.painelFiscal) return opts.canReadPainelFiscal
  if (item.diretorOnly && !opts.isDiretor) return false
  if (item.hideForDiretor && opts.isDiretor) return false
  return true
}

export default function Layout() {
  const { signOut, session, isAdmin, isDiretor, canReadPainelFiscal } = useAuth()
  const location = useLocation()
  const access = { isDiretor, canReadPainelFiscal }

  const pathMatchesItem = (item: NavItem) => {
    if (item.end) return location.pathname === item.to
    return (
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
    )
  }

  const configActive = adminConfigNav.some((item) => pathMatchesItem(item))
  const dashboardsItems = isAdmin
    ? dashboardsNav
    : dashboardsNav.filter((item) => filterNavItem(item, access))
  const dashboardsActive = dashboardsItems.some((item) => pathMatchesItem(item))
  const contenciosoItems = isAdmin
    ? contenciosoNav
    : contenciosoNav.filter((item) => filterNavItem(item, access))
  const contenciosoActive = contenciosoItems.some((item) => pathMatchesItem(item))
  const tarefasItems = isAdmin
    ? tarefasNav
    : tarefasNav.filter((item) => filterNavItem(item, access))
  const tarefasActive = tarefasItems.some((item) => pathMatchesItem(item))
  const valoresItems = isAdmin
    ? valoresNav
    : valoresNav.filter((item) => filterNavItem(item, access))
  const valoresActive = valoresItems.some((item) => pathMatchesItem(item))

  const [configOpen, setConfigOpen] = useState(configActive)
  const [dashboardsOpen, setDashboardsOpen] = useState(dashboardsActive)
  const [contenciosoOpen, setContenciosoOpen] = useState(contenciosoActive)
  const [tarefasOpen, setTarefasOpen] = useState(tarefasActive)
  const [valoresOpen, setValoresOpen] = useState(valoresActive)
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

  useEffect(() => {
    if (dashboardsActive) setDashboardsOpen(true)
  }, [dashboardsActive])

  useEffect(() => {
    if (contenciosoActive) setContenciosoOpen(true)
  }, [contenciosoActive])

  useEffect(() => {
    if (tarefasActive) setTarefasOpen(true)
  }, [tarefasActive])

  useEffect(() => {
    if (valoresActive) setValoresOpen(true)
  }, [valoresActive])

  useEffect(() => {
    if (configActive) setConfigOpen(true)
  }, [configActive])

  const closeIfNarrow = () => {
    if (isNarrow) setPinned(false)
  }

  const visibleNav = isAdmin
    ? adminMainNav
    : otherNav.filter((item) => filterNavItem(item, access))

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
                className="flex h-10 w-10 items-center justify-center overflow-hidden"
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
                  'overflow-hidden transition',
                  expanded ? 'px-1 py-1' : 'flex h-10 w-10 items-center justify-center',
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
              </div>
            )}
          </div>
        </div>

        <nav className={['min-h-0 flex-1 space-y-1 overflow-y-auto py-4', expanded ? 'px-3' : 'px-2'].join(' ')}>
          <NavSubmenu
            label="Dashboards"
            icon={LayoutDashboard}
            items={dashboardsItems}
            open={dashboardsOpen}
            setOpen={setDashboardsOpen}
            active={dashboardsActive}
            expanded={expanded}
            isNarrow={isNarrow}
            onExpandNarrow={() => setPinned(true)}
            onSelect={closeIfNarrow}
          />

          <NavSubmenu
            label="Valores"
            icon={CircleDollarSign}
            items={valoresItems}
            open={valoresOpen}
            setOpen={setValoresOpen}
            active={valoresActive}
            expanded={expanded}
            isNarrow={isNarrow}
            onExpandNarrow={() => setPinned(true)}
            onSelect={closeIfNarrow}
          />

          <NavSubmenu
            label="Contencioso"
            icon={Gavel}
            items={contenciosoItems}
            open={contenciosoOpen}
            setOpen={setContenciosoOpen}
            active={contenciosoActive}
            expanded={expanded}
            isNarrow={isNarrow}
            onExpandNarrow={() => setPinned(true)}
            onSelect={closeIfNarrow}
          />

          <NavSubmenu
            label="Tarefas"
            icon={ListTodo}
            items={tarefasItems}
            open={tarefasOpen}
            setOpen={setTarefasOpen}
            active={tarefasActive}
            expanded={expanded}
            isNarrow={isNarrow}
            onExpandNarrow={() => setPinned(true)}
            onSelect={closeIfNarrow}
          />

          {visibleNav.map((item) => (
            <NavItemLink key={item.to} item={item} expanded={expanded} onSelect={closeIfNarrow} />
          ))}

          {isAdmin && (
            <NavSubmenu
              label="Configurações"
              icon={Settings}
              items={adminConfigNav}
              open={configOpen}
              setOpen={setConfigOpen}
              active={configActive}
              expanded={expanded}
              isNarrow={isNarrow}
              onExpandNarrow={() => setPinned(true)}
              onSelect={closeIfNarrow}
            />
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
