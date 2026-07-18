// Layout renderer (CD-417). Renders a published `cyberdeck.layout` page on its grid:
// each widget is placed by its col/row/span (the flatten step already snapped px frames
// to grid cells, CD-416), so this is a faithful projection of the PUBLISHED doc — not
// the authoring board. Widgets draw as typed placeholders; the real per-type visuals
// arrive with the platform-loaded canon widgets (CD-423) on the player.
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'

const DEFAULT_GRID = { columns: 24, rows: 18 }

export function LayoutView({ layout }: { layout: LayoutDocument }) {
  const page = layout.pages[0]
  const grid = page?.grid ?? DEFAULT_GRID
  const columns = grid.columns ?? DEFAULT_GRID.columns
  const rows = grid.rows ?? DEFAULT_GRID.rows
  const widgets = page?.widgets ?? []

  return (
    <div
      className="pv-layout"
      data-testid="layout-view"
      data-widget-count={widgets.length}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          className="pv-widget"
          data-widget-id={w.id}
          data-widget-type={w.type}
          style={{
            gridColumn: `${w.placement.col + 1} / span ${w.placement.colSpan ?? 1}`,
            gridRow: `${w.placement.row + 1} / span ${w.placement.rowSpan ?? 1}`,
          }}
        >
          <span className="pv-widget__type">{w.type.split('.').at(-1) ?? w.type}</span>
        </div>
      ))}
      {widgets.length === 0 && <p className="pv-layout__empty">This page has no widgets.</p>}
    </div>
  )
}
