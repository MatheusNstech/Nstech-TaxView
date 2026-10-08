import { Building2, Calculator, Layers, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import EmpresaCard from '../components/empresas/EmpresaCard'
import EmpresaEditModal from '../components/empresas/EmpresaEditModal'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { currentCompetenciaMonth, formatCompetencia, monthToCompetencia } from '../lib/format'
import type { EmpresaGrupo } from '../types'

const TODOS = ''

function normaliza(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function CardSkeleton() {
  return (
    <div className="card-surface animate-pulse overflow-hidden">
      <div className="h-24 bg-[color:var(--color-surface)]" />
      <div className="-mt-9 flex justify-center">
        <div className="h-[4.5rem] w-[4.5rem] rounded-full border-4 border-[color:var(--color-panel)] bg-[color:var(--color-surface)]" />
      </div>
      <div className="space-y-2 px-5 py-4">
        <div className="mx-auto h-4 w-32 rounded bg-[color:var(--color-surface)]" />
        <div className="mx-auto h-3 w-44 rounded bg-[color:var(--color-surface)]" />
        <div className="mt-5 h-16 rounded-xl bg-[color:var(--color-surface)]" />
      </div>
    </div>
  )
}

export default function EmpresasPainel() {
  const { isAdmin } = useAuth()
  const [grupos, setGrupos] = useState<EmpresaGrupo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mes, setMes] = useState(currentCompetenciaMonth())
  const [busca, setBusca] = useState('')
  const [bu, setBu] = useState(TODOS)
  const [contabil, setContabil] = useState(TODOS)
  const [editando, setEditando] = useState<EmpresaGrupo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setGrupos(
        await apiFetch<EmpresaGrupo[]>(
          `/api/empresas/painel?competencia=${monthToCompetencia(mes)}`,
        ),
      )
    } catch (err) {
      setGrupos([])
      setError(err instanceof Error ? err.message : 'Erro ao carregar empresas')
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => {
    void load()
  }, [load])

  const buOptions = useMemo(() => {
    const set = new Set(grupos.flatMap((g) => g.bus))
    return [
      { value: TODOS, label: 'Todas as BUs' },
      ...[...set].sort().map((b) => ({ value: b, label: b })),
    ]
  }, [grupos])

  const contabilOptions = useMemo(() => {
    const set = new Set(
      grupos.flatMap((g) => g.contatos.contabil.map((c) => c.nome ?? '').filter(Boolean)),
    )
    return [
      { value: TODOS, label: 'Todos (contábil)' },
      ...[...set].sort().map((n) => ({ value: n, label: n })),
    ]
  }, [grupos])

  const visiveis = useMemo(() => {
    const termo = normaliza(busca.trim())
    const termoDigitos = busca.replace(/\D/g, '')
    return grupos.filter((g) => {
      if (bu && !g.bus.includes(bu)) return false
      if (contabil && !g.contatos.contabil.some((c) => c.nome === contabil)) return false
      if (!termo) return true
      const unidades = [g.matriz, ...g.filiais]
      const textos = [
        g.nome,
        ...unidades.map((u) => u.razao_social),
        ...unidades.map((u) => u.nome_fantasia ?? ''),
        ...g.contatos.contas_pagar.map((c) => c.email ?? ''),
        ...g.responsaveis_fiscais.map((r) => r.nome),
      ]
      if (textos.some((t) => normaliza(t).includes(termo))) return true
      return (
        termoDigitos.length >= 3 &&
        unidades.some((u) => u.cnpj.replace(/\D/g, '').includes(termoDigitos))
      )
    })
  }, [grupos, busca, bu, contabil])

  const totalCnpjs = grupos.reduce((acc, g) => acc + 1 + g.filiais.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Empresas</h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {loading
                ? 'Carregando...'
                : `${grupos.length} empresas atendidas · ${totalCnpjs} CNPJs · obrigações de ${formatCompetencia(monthToCompetencia(mes))}`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]"
            strokeWidth={1.75}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, razão social, CNPJ, e-mail ou responsável"
            className="glass-input pl-9"
            aria-label="Buscar empresa"
          />
        </div>
        <GlassSelect
          value={bu}
          onChange={setBu}
          options={buOptions}
          icon={Layers}
          ariaLabel="Filtrar por BU"
          className="w-48"
        />
        <GlassSelect
          value={contabil}
          onChange={setContabil}
          options={contabilOptions}
          icon={Calculator}
          ariaLabel="Filtrar por responsável contábil"
          className="w-52"
          align="right"
        />
        <GlassMonthPicker value={mes} onChange={setMes} ariaLabel="Competência" align="right" />
      </div>

      {error && <p className="rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)
        ) : visiveis.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-[color:var(--color-muted)]">
            Nenhuma empresa encontrada com esses filtros
          </p>
        ) : (
          visiveis.map((g) => (
            <EmpresaCard key={g.raiz} grupo={g} canEdit={isAdmin} onEdit={setEditando} />
          ))
        )}
      </div>

      <EmpresaEditModal
        grupo={editando}
        onClose={() => setEditando(null)}
        onSaved={() => {
          setEditando(null)
          void load()
        }}
      />
    </div>
  )
}
