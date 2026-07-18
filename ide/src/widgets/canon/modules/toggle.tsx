// Toggle switch canon widget (CD-423).
import '../canon.css'

export default function ToggleWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { on?: boolean; label?: string }
  return (
    <div className="cw cw-toggle" data-widget-kind="toggle" data-on={c.on || undefined}>
      <span className="cw-toggle__track" aria-hidden="true">
        <span className="cw-toggle__knob" />
      </span>
      {c.label && <span className="cw-toggle__label">{c.label}</span>}
    </div>
  )
}
