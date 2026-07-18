// Static image canon widget (CD-423). Shows the source, or a placeholder frame.
import '../canon.css'

export default function ImageWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { src?: string; fit?: string; alt?: string }
  if (c.src) {
    return (
      <img
        className="cw cw-image"
        data-widget-kind="image"
        src={c.src}
        alt={c.alt ?? ''}
        style={{ objectFit: (c.fit as 'cover' | 'contain' | 'fill' | undefined) ?? 'cover' }}
      />
    )
  }
  return (
    <div className="cw cw-image cw-image--empty" data-widget-kind="image" aria-hidden="true">
      🖼
    </div>
  )
}
