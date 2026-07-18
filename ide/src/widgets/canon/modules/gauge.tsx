// Circular gauge canon widget (CD-423). Lazily loaded via the platform resolver.
import '../canon.css'

export default function GaugeWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { value?: number; min?: number; max?: number }
  const min = c.min ?? 0
  const max = c.max ?? 100
  const value = c.value ?? Math.round((min + max) / 2)
  const pct = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0
  return (
    <div className="cw cw-gauge" data-widget-kind="gauge">
      <svg viewBox="0 0 36 36" className="cw-gauge__ring" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" className="cw-gauge__track" />
        <circle cx="18" cy="18" r="15.5" className="cw-gauge__fill" style={{ strokeDasharray: `${pct * 97} 97` }} />
      </svg>
      <span className="cw-gauge__value">{value}</span>
    </div>
  )
}
