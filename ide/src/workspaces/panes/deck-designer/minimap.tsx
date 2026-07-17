// Minimap (CD-314). A registered dock tool window that renders the whole board from
// the single board-model selector, scaled to fit, with a live viewport rectangle
// derived from the shared canvas view. Click or drag inside it recenters the canvas
// (via the view bus). Updates live on any board change (AC) — same selector as the
// Live Mirror.
import { useRef } from 'react'
import { screenToWorld, visibleWorldRect } from '@/shared/canvas'
import { useProjectModel } from './use-project-model'
import { useBoardModel } from './board-model'
import { useCanvasView, useCanvasViewBus } from './use-canvas-view'
import './minimap.css'

export function Minimap({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const board = useBoardModel(model, pageId)
  const view = useCanvasView()
  const bus = useCanvasViewBus()
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const W = 220
  const scale = board.bounds.w > 0 ? W / board.bounds.w : 1
  const H = Math.max(40, board.bounds.h * scale)

  // The world rect currently visible in the canvas → the viewport indicator.
  const vp = view.size.w > 0 ? visibleWorldRect(view.transform, view.size) : { x: 0, y: 0, w: 0, h: 0 }

  const centerFromEvent = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    const world = {
      x: (clientX - rect.left) / scale + board.origin.x,
      y: (clientY - rect.top) / scale + board.origin.y,
    }
    bus.centerOn(world)
    void screenToWorld
  }

  return (
    <div
      ref={boxRef}
      className="dd-minimap"
      data-testid="minimap"
      role="img"
      aria-label="Board minimap"
      style={{ width: W, height: H }}
      onPointerDown={(e) => {
        dragging.current = true
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        centerFromEvent(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => dragging.current && centerFromEvent(e.clientX, e.clientY)}
      onPointerUp={(e) => {
        dragging.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
      }}
    >
      {board.cells
        .filter((c) => !c.hidden)
        .map((c) => (
          <div
            key={c.id}
            className="dd-minimap-cell"
            data-cell={c.id}
            style={{
              left: (c.frame.x - board.origin.x) * scale,
              top: (c.frame.y - board.origin.y) * scale,
              width: Math.max(1, c.frame.w * scale),
              height: Math.max(1, c.frame.h * scale),
              background: c.color ?? undefined,
            }}
          />
        ))}
      {vp.w > 0 && (
        <div
          className="dd-minimap-viewport"
          data-testid="minimap-viewport"
          style={{ left: (vp.x - board.origin.x) * scale, top: (vp.y - board.origin.y) * scale, width: vp.w * scale, height: vp.h * scale }}
        />
      )}
    </div>
  )
}
