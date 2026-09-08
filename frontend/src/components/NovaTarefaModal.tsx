import { Building2, Plus, Tags, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import GlassDatePicker from './GlassDatePicker'
import GlassSelect from './GlassSelect'
import { apiFetch } from '../lib/api'
import { formatTime } from '../lib/format'
import type {
  Empresa,
  Responsavel,
  Tarefa,
  TarefaCategoria,
  TarefaCreate,
} from '../types'
import { TAREFA_CATEGORIA_OPTIONS } from '../types'

interface NovaTarefaModalProps {
  open: boolean
  onClose: () => void
  onCreated: (tarefa: Tarefa) => void
  defaultCompetencia: string
  defaultResponsavelId?: string | null
  empresas: Empresa[]
  responsaveis?: Responsavel[]
  allowPickResponsavel?: boolean
}

export default function NovaTarefaModal({
  open,
  onClose,
  onCreated,
  defaultCompetencia,
  defaultResponsavelId,
  empresas,
  responsaveis = [],
  allowPickResponsavel = false,
}: NovaTarefaModalProps) {
  const [titulo, setTitulo] = useState('')
  const [solicitanteNome, setSolicitanteNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prazo, setPrazo] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFim, setHoraFim] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [categoria, setCategoria] = useState<TarefaCategoria>('fechamento')
  const [responsavelId, setResponsavelId] = useState(defaultResponsavelId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const categoriaOptions = useMemo(
    () => TAREFA_CATEGORIA_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  const empresaOptions = useMemo(
    () => [
      { value: '', label: 'Sem empresa' },
      ...empresas.map((em) => ({ value: em.id, label: em.razao_social })),
    ],
    [empresas],
  )

  const responsavelOptions = useMemo(
    () => [
      { value: '', label: 'Eu / padrão' },
      ...responsaveis.map((r) => ({ value: r.id, label: r.nome })),
    ],
    [responsaveis],
  )

  useEffect(() => {
    if (!open) return
    setTitulo('')
    setSolicitanteNome('')
    setDescricao('')
    setPrazo('')
    setHoraInicio('')
    setHoraFim('')
    setEmpresaId('')
    setCategoria('fechamento')
    setResponsavelId(defaultResponsavelId ?? '')
    setError('')
  }, [open, defaultResponsavelId])

  if (!open) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = titulo.trim()
    const solicitante = solicitanteNome.trim()
    if (!trimmed) {
      setError('Informe o título da tarefa')
      return
    }
    if (solicitante.length < 2) {
      setError('Informe o nome do solicitante')
      return
    }
    const inicio = formatTime(horaInicio)
    const fim = formatTime(horaFim)
    if (!prazo || !inicio || !fim) {
      setError('Informe o prazo e o horário de início e fim')
      return
    }
    if (fim <= inicio) {
      setError('O horário final deve ser depois do início')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const body: TarefaCreate = {
        titulo: trimmed,
        solicitante_nome: solicitante,
        descricao: descricao.trim() || null,
        categoria,
        competencia: defaultCompetencia || null,
        prazo,
        hora_inicio: inicio,
        hora_fim: fim,
        empresa_id: empresaId || null,
        responsavel_id: responsavelId || null,
      }
      const created = await apiFetch<Tarefa>('/api/tarefas', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar tarefa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative z-10 w-full max-w-md rounded-[1.25rem] border border-[color:var(--color-line)] bg-white p-5 shadow-2xl dark:bg-[color:var(--color-panel)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-[color:var(--color-ink)]">
            Nova tarefa
          </h2>
          <button type="button" className="btn-ghost !p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Título
            </label>
            <input
              autoFocus
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="glass-input py-2.5"
              placeholder="Ex.: Revisar planilha de ISS da ATSLOG"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Solicitante
            </label>
            <input
              required
              value={solicitanteNome}
              onChange={(e) => setSolicitanteNome(e.target.value)}
              className="glass-input py-2.5"
              placeholder="Nome de quem solicitou"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Categoria
            </label>
            <GlassSelect
              ariaLabel="Categoria"
              icon={Tags}
              value={categoria}
              onChange={(v) => setCategoria(v as TarefaCategoria)}
              options={categoriaOptions}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="glass-input resize-none py-2.5"
              placeholder="Detalhes opcionais"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Início
              </label>
              <input
                type="time"
                required
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="glass-input py-2.5"
                aria-label="Horário de início"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Fim
              </label>
              <input
                type="time"
                required
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="glass-input py-2.5"
                aria-label="Horário de fim"
              />
            </div>
          </div>
          <p className="-mt-1 text-[11px] text-[color:var(--color-muted)]">
            Obrigatório. O atraso continua só pelo dia do prazo, não pelo horário.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Prazo
              </label>
              <GlassDatePicker
                ariaLabel="Prazo"
                value={prazo}
                onChange={setPrazo}
                placement="top"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Empresa
              </label>
              <GlassSelect
                ariaLabel="Empresa"
                icon={Building2}
                value={empresaId}
                onChange={setEmpresaId}
                options={empresaOptions}
                align="right"
                placement="top"
                listClassName="max-h-48 min-w-[14rem] max-w-[min(18rem,calc(100vw-2rem))]"
              />
            </div>
          </div>

          {allowPickResponsavel && responsaveis.length > 0 ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
                Responsável
              </label>
              <GlassSelect
                ariaLabel="Responsável"
                icon={UserRound}
                value={responsavelId}
                onChange={setResponsavelId}
                options={responsavelOptions}
                placement="top"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {submitting ? 'Criando...' : 'Criar tarefa'}
          </button>
        </div>
      </form>
    </div>
  )
}
