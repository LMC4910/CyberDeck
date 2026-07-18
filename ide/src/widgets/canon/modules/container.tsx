// Container canon widget (CD-423). A layout frame; children compose on the board.
import '../canon.css'

export default function ContainerWidget({ config }: { config?: unknown }) {
  const c = (config ?? {}) as { label?: string; direction?: 'row' | 'column' }
  return (
    <div className="cw cw-container" data-widget-kind="container" data-direction={c.direction ?? 'column'}>
      {c.label && <span className="cw-container__label">{c.label}</span>}
    </div>
  )
}
