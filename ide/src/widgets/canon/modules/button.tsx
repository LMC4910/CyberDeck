// Action button canon widget (CD-423).
import '../canon.css'

export default function ButtonWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { label?: string; style?: string }
  return (
    <div className="cw cw-button" data-widget-kind="button" data-style={c.style ?? 'solid'}>
      <span className="cw-button__label">{c.label ?? 'Button'}</span>
    </div>
  )
}
