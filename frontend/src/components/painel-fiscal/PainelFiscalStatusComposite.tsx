export default function PainelFiscalStatusComposite({
  totalEmpresas,
  baixadas,
  cndValida,
  cndPendente,
}: {
  totalEmpresas: number
  baixadas: number
  cndValida: number
  cndPendente: number
}) {
  const cards = [
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
    },
    {
      label: 'CND pendentes',
      value: cndPendente,
      tone: 'text-rose-700',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="kpi-card glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            {card.label}
          </p>
          <p
            className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${card.tone}`}
          >
            {card.value.toLocaleString('pt-BR')}
          </p>
        </div>
      ))}
    </div>
  )
}
