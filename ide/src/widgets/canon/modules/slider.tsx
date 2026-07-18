// Range slider canon widget (CD-423).
import '../canon.css'

export default function SliderWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { value?: number; min?: number; max?: number }
  const min = c.min ?? 0
  const max = c.max ?? 100
  const value = c.value ?? Math.round((min + max) / 2)
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0
  return (
    <div className="cw cw-slider" data-widget-kind="slider">
      <span className="cw-slider__track" aria-hidden="true">
        <span className="cw-slider__fill" style={{ width: `${pct}%` }} />
        <span className="cw-slider__knob" style={{ left: `${pct}%` }} />
      </span>
    </div>
  )
}
