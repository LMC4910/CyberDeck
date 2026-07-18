// Layout renderer (CD-417). Renders a published `cyberdeck.layout` page on its grid:
// each widget is placed by its col/row/span (the flatten step already snapped px frames
// to grid cells, CD-416), so this is a faithful projection of the PUBLISHED doc — not
// the authoring board. Widgets draw as typed placeholders; the real per-type visuals
// arrive with the platform-loaded canon widgets (CD-423) on the player.
import { useCallback, useRef, useState } from 'react'
import type { CyberDeckPublishedLayoutDocumentCyberdeckLayout as LayoutDocument } from '@/shared/contract'
import { classifyTouch, verbFor, type TouchSimEvent } from './touch-sim'

const DEFAULT_GRID = { columns: 24, rows: 18 }

export interface LayoutViewProps {
  layout: LayoutDocument
  /** Touch-simulation mode (CD-418): widgets are pressable and emit tap/hold events. */
  interactive?: boolean
  onTouch?: (event: TouchSimEvent) => void
}

export function LayoutView({ layout, interactive = false, onTouch }: LayoutViewProps) {
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
      data-interactive={interactive || undefined}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {widgets.map((w) => (
        <PreviewWidget
          key={w.id}
          id={w.id}
          type={w.type}
          col={w.placement.col}
          row={w.placement.row}
          colSpan={w.placement.colSpan ?? 1}
          rowSpan={w.placement.rowSpan ?? 1}
          interactive={interactive}
          onTouch={onTouch}
        />
      ))}
      {widgets.length === 0 && <p className="pv-layout__empty">This page has no widgets.</p>}
    </div>
  )
}

interface PreviewWidgetProps {
  id: string
  type: string
  col: number
  row: number
  colSpan: number
  rowSpan: number
  interactive: boolean
  onTouch?: (event: TouchSimEvent) => void
}

function PreviewWidget({ id, type, col, row, colSpan, rowSpan, interactive, onTouch }: PreviewWidgetProps) {
  const [pressed, setPressed] = useState(false)
  const [ripple, setRipple] = useState(0) // bump a key to restart the ripple animation
  const downAt = useRef(0)

  const onPointerDown = useCallback(() => {
    if (!interactive) return
    downAt.current = performance.now()
    setPressed(true)
    setRipple((n) => n + 1)
  }, [interactive])

  const onPointerUp = useCallback(() => {
    if (!interactive || !pressed) return
    setPressed(false)
    const up = performance.now()
    const gesture = classifyTouch(downAt.current, up)
    onTouch?.({ widgetId: id, type, gesture, verb: verbFor(type, gesture), ts: up })
  }, [interactive, pressed, id, type, onTouch])

  return (
    <div
      className="pv-widget"
      data-widget-id={id}
      data-widget-type={type}
      data-pressed={pressed || undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      style={{
        gridColumn: `${col + 1} / span ${colSpan}`,
        gridRow: `${row + 1} / span ${rowSpan}`,
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={() => setPressed(false)}
    >
      <span className="pv-widget__type">{type.split('.').at(-1) ?? type}</span>
      {interactive && pressed && <span key={ripple} className="pv-ripple" aria-hidden="true" />}
    </div>
  )
}
