export type CndKpiKey = 'valida' | 'pendente'

export default function PainelFiscalStatusComposite({
  totalEmpresas,
  baixadas,
  cndValida,
  cndPendente,
  onCndClick,
}: {
  totalEmpresas: number
  baixadas: number
  cndValida: number
  cndPendente: number
  onCndClick?: (key: CndKpiKey) => void
}) {
  const cells: {
    label: string
    value: number
    tone: string
    cndKey?: CndKpiKey
  }[] = [
    {
      label: 'Empresas',
      value: totalEmpresas,
      tone: 'text-[color:var(--color-ink)]',
    },
    {
      label: 'Empresas baixadas',
      value: baixadas,
      tone: 'text-[color:var(--color-muted)]',
    },
    {
      label: 'CND válidas',
      value: cndValida,
      tone: 'text-emerald-700',
      cndKey: 'valida',
    },
    {
      label: 'CND pendentes',
      value: cndPendente,
      tone: 'text-rose-700',
      cndKey: 'pendente',
    },
  ]

  return (
    <div className="glass-panel overflow-hidden !rounded-3xl p-0">
      <div className="grid grid-cols-2 divide-x divide-y divide-[color:var(--color-line)] lg:grid-cols-4 lg:divide-y-0">
        {cells.map((cell) => {
          const clickable = Boolean(cell.cndKey && onCndClick)
          const className = `p-5 text-left ${
            clickable
              ? 'cursor-pointer transition hover:bg-[color:var(--nav-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
              : ''
          }`

          const body = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                {cell.label}
              </p>
              <p
                className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${cell.tone}`}
              >
                {cell.value.toLocaleString('pt-BR')}
              </p>
              {clickable ? (
                <p className="mt-1.5 text-[11px] text-[color:var(--color-muted)]">
                  Ver detalhes
                </p>
              ) : null}
            </>
          )

          if (clickable && cell.cndKey) {
            return (
              <button
                key={cell.label}
                type="button"
                className={className}
                onClick={() => onCndClick?.(cell.cndKey!)}
              >
                {body}
              </button>
            )
          }

          return (
            <div key={cell.label} className={className}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
