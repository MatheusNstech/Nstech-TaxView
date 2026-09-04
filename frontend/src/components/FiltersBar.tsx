import {
  Building2,
  Filter,
  Search,
  UserRound,
} from 'lucide-react'
import GlassMonthPicker from './GlassMonthPicker'
import GlassSelect from './GlassSelect'
import type { FilterValues, Responsavel, StatusObrigacao } from '../types'

interface FiltersBarProps {
  filters: FilterValues
  onChange: (filters: FilterValues) => void
  bus?: string[]
  responsaveis?: Responsavel[]
  showStatus?: boolean
  showSearch?: boolean
}

const statusOptions: { value: StatusObrigacao | ''; label: string }[] = [
  { value: '', label: 'Status' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'EM_REVISAO', label: 'Em revisão' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'ATRASADO', label: 'Atrasado' },
]

const controlClass = 'glass-control'

export default function FiltersBar({
  filters,
  onChange,
  bus = [],
  responsaveis = [],
  showStatus = true,
  showSearch = true,
}: FiltersBarProps) {
  const update = (patch: Partial<FilterValues>) =>
    onChange({ ...filters, ...patch })

  const buOptions = [
    { value: '', label: 'Todas as BUs' },
    ...bus.map((bu) => ({ value: bu, label: bu })),
  ]

  const responsavelOptions = [
    { value: '', label: 'Responsável' },
    ...responsaveis.map((r) => ({ value: r.id, label: r.nome })),
  ]

  return (
    <div className="glass-panel sticky top-3 z-20 flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
        <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
      </div>

      <GlassMonthPicker
        className="w-[8.25rem] shrink-0"
        value={filters.competencia}
        onChange={(competencia) => update({ competencia })}
      />

      <GlassSelect
        className="min-w-[8.5rem] flex-1 basis-[8.5rem]"
        icon={Building2}
        ariaLabel="BU"
        value={filters.bu}
        onChange={(bu) => update({ bu })}
        options={buOptions}
      />

      {responsaveis.length > 0 && (
        <GlassSelect
          className="min-w-[9rem] flex-1 basis-[9rem]"
          icon={UserRound}
          ariaLabel="Responsável"
          value={filters.responsavel_id ?? ''}
          onChange={(responsavel_id) => update({ responsavel_id })}
          options={responsavelOptions}
        />
      )}

      {showStatus && (
        <GlassSelect
          className="min-w-[8rem] flex-1 basis-[8rem]"
          icon={Filter}
          ariaLabel="Status"
          value={filters.status}
          onChange={(status) => update({ status })}
          options={statusOptions}
        />
      )}

      {showSearch && (
        <div className="relative min-w-[12rem] flex-[1.4] basis-[12rem]">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]"
            strokeWidth={1.75}
          />
          <input
            type="search"
            aria-label="Buscar"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className={controlClass}
          />
        </div>
      )}
    </div>
  )
}
