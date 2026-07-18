// Media (video) canon widget (CD-423). Designer preview is a framed play affordance.
import '../canon.css'

export default function MediaWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { title?: string }
  return (
    <div className="cw cw-media" data-widget-kind="media">
      <span className="cw-media__play" aria-hidden="true">
        ▶
      </span>
      {c.title && <span className="cw-media__title">{c.title}</span>}
    </div>
  )
}
