import { Columns3, FileSpreadsheet, Upload } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiUpload } from '../lib/api'
import {
  currentCompetenciaMonth,
  formatCompetencia,
  monthToCompetencia,
} from '../lib/format'
import type { ImportResult } from '../types'

export default function Importacao() {
  const [file, setFile] = useState<File | null>(null)
  const [competencia, setCompetencia] = useState(currentCompetenciaMonth())
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Selecione um arquivo CSV')
      return
    }

    setUploading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const competenciaDate = monthToCompetencia(competencia)
      const data = await apiUpload<ImportResult>(
        `/api/importacao/csv?competencia=${competenciaDate}`,
        formData,
      )
      setResult(data)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
          <Upload className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-ink)]">
            Importação
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            Importe o cronograma fiscal a partir de um arquivo CSV
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="glass-panel max-w-xl p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[color:var(--color-muted)]">
              Competência
            </label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="glass-input"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-muted)]">
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
              Arquivo CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-[color:var(--color-muted)] file:mr-4 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50/90 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          className="btn-primary mt-6 w-full"
        >
          <Upload className="h-4 w-4" strokeWidth={1.75} />
          {uploading ? 'Importando...' : 'Importar CSV'}
        </button>
      </form>

      {result && (
        <div className="glass-panel max-w-xl p-6">
          <h3 className="text-sm font-semibold text-brand-800">
            Importação concluída — {formatCompetencia(result.competencia)}
          </h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-brand-600">Empresas</dt>
              <dd className="text-lg font-bold text-brand-800">{result.empresas}</dd>
            </div>
            <div>
              <dt className="text-brand-600">Atividades</dt>
              <dd className="text-lg font-bold text-brand-800">{result.atividades}</dd>
            </div>
            <div>
              <dt className="text-brand-600">Responsáveis</dt>
              <dd className="text-lg font-bold text-brand-800">{result.responsaveis}</dd>
            </div>
            <div>
              <dt className="text-brand-600">Obrigações</dt>
              <dd className="text-lg font-bold text-brand-800">{result.obrigacoes}</dd>
            </div>
          </dl>
          <Link to="/minhas-tarefas" className="btn-ghost mt-4 text-brand-700">
            <Columns3 className="h-4 w-4" strokeWidth={1.75} />
            Ver em Minhas tarefas
          </Link>
        </div>
      )}
    </div>
  )
}
