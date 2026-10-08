import { Calculator, Layers, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import EmpresaCard from '../components/empresas/EmpresaCard'
import EmpresaDetalheModal from '../components/empresas/EmpresaDetalheModal'
import EmpresaEditModal from '../components/empresas/EmpresaEditModal'
import GlassMonthPicker from '../components/GlassMonthPicker'
import GlassSelect from '../components/GlassSelect'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { currentCompetenciaMonth, monthToCompetencia } from '../lib/format'
import type { EmpresaGrupo } from '../types'

const TODOS = ''

function normaliza(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function palavras(texto: string): string[] {
  return normaliza(texto).split(/[^a-z0-9]+/).filter(Boolean)
}

function CardSkeleton() {
  return (
    <div className="card-surface flex h-full animate-pulse flex-col p-3">
      <div className="aspect-[16/9] rounded-xl bg-[color:var(--color-surface)]" />
      <div className="mt-3 flex gap-1.5 px-1">
        <div className="h-6 w-16 rounded-lg bg-[color:var(--color-surface)]" />
        <div className="h-6 w-12 rounded-lg bg-[color:var(--color-surface)]" />
      </div>
      <div className="mb-3 mt-2.5 min-h-[2.75rem] space-y-1.5 px-1">
        <div className="h-4 w-32 rounded bg-[color:var(--color-surface)]" />
        <div className="h-3 w-44 rounded bg-[color:var(--color-surface)]" />
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-[color:var(--color-line)] px-1 pt-3">
        <div className="h-8 w-14 rounded bg-[color:var(--color-surface)]" />
        <div className="h-8 w-28 rounded-xl bg-[color:var(--color-surface)]" />
      </div>
    </div>
  )
}

export default function EmpresasPainel() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [grupos, setGrupos] = useState<EmpresaGrupo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mes, setMes] = useState(currentCompetenciaMonth())
  const [busca, setBusca] = useState('')
  const [bu, setBu] = useState(TODOS)
  const [contabil, setContabil] = useState(TODOS)
  const [editando, setEditando] = useState<EmpresaGrupo | null>(null)
  const [detalhe, setDetalhe] = useState<EmpresaGrupo | null>(null)

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

  useEffect(() => {
    const raiz = searchParams.get('raiz')
    if (!raiz || grupos.length === 0) return
    const alvo = grupos.find((g) => g.raiz === raiz)
    if (alvo) setDetalhe(alvo)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('raiz')
        return next
      },
      { replace: true },
    )
  }, [grupos, searchParams, setSearchParams])

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
    const bruto = busca.trim()
    const termos = palavras(bruto)
    const soCnpj = /^[\d\s./-]+$/.test(bruto)
    const termoDigitos = bruto.replace(/\D/g, '')
    return grupos.filter((g) => {
      if (bu && !g.bus.includes(bu)) return false
      if (contabil && !g.contatos.contabil.some((c) => c.nome === contabil)) return false
      if (!bruto) return true
      const unidades = [g.matriz, ...g.filiais]
      if (soCnpj) {
        return (
          termoDigitos.length >= 2 &&
          unidades.some((u) => u.cnpj.replace(/\D/g, '').startsWith(termoDigitos))
        )
      }
      if (bruto.includes('@')) {
        const email = normaliza(bruto)
        return unidades
          .flatMap((u) => u.contatos)
          .concat(g.contatos.contas_pagar)
          .some((c) => normaliza(c.email ?? '').includes(email))
      }
      const vocabulario = [
        g.nome,
        ...unidades.map((u) => u.razao_social),
        ...unidades.map((u) => u.nome_fantasia ?? ''),
      ].flatMap(palavras)
      return termos.every((t) => vocabulario.some((p) => p.startsWith(t)))
    })
  }, [grupos, busca, bu, contabil])

  const verObrigacoes = (g: EmpresaGrupo, apenasAtrasadas: boolean) => {
    const q = g.raiz.startsWith('id:')
      ? g.matriz.razao_social
      : `${g.raiz.slice(0, 2)}.${g.raiz.slice(2, 5)}.${g.raiz.slice(5, 8)}`
    const params = new URLSearchParams({ competencia: mes, q })
    if (apenasAtrasadas) params.set('status', 'ATRASADO')
    navigate(`/obrigacoes?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">Empresas</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-muted)]"
            strokeWidth={1.75}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, razão social, CNPJ ou e-mail"
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
            <EmpresaCard
              key={g.raiz}
              grupo={g}
              canEdit={isAdmin}
              onEdit={setEditando}
              onOpen={setDetalhe}
              onVerObrigacoes={verObrigacoes}
            />
          ))
        )}
      </div>

      <EmpresaDetalheModal
        grupo={detalhe}
        canEdit={isAdmin}
        onClose={() => setDetalhe(null)}
        onVerObrigacoes={verObrigacoes}
        onEdit={(g) => {
          setDetalhe(null)
          setEditando(g)
        }}
      />

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
