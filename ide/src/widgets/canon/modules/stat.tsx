// Stat readout canon widget (CD-423).
import '../canon.css'

export default function StatWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { value?: number | string; label?: string; precision?: number }
  const value =
    typeof c.value === 'number' ? c.value.toFixed(c.precision ?? 0) : (c.value ?? '—')
  return (
    <div className="cw cw-stat" data-widget-kind="stat">
      <span className="cw-stat__value">{value}</span>
      {c.label && <span className="cw-stat__label">{c.label}</span>}
    </div>
  )
}
