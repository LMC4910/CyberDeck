// Text label canon widget (CD-423).
import '../canon.css'

export default function TextWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { text?: string; size?: number }
  return (
    <div className="cw cw-text" data-widget-kind="text" style={{ fontSize: c.size ? `${c.size}px` : undefined }}>
      {c.text ?? 'Text'}
    </div>
  )
}
