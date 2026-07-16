// Deck Designer pane (CD-203 → CD-303 board → CD-304 shared model → CD-305 selection).
// Composes the authoring canvas: a shared PanZoomSurface (CD-301) whose world layer
// is the model-driven Board (CD-303), with the single selection store (CD-305)
// driving the selection ring and the canvas gestures (click/⇧/⌘, marquee, lasso,
// Tab cycle, Esc, history). The ProjectModel is the source of truth. Drag/resize,
// snapping, inspector and layers arrive across CD-306…328.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanZoomSurface, IDENTITY, type PanZoomHandle, type ViewTransform } from '@/shared/canvas'
import { Board } from './deck-designer/board'
import { useProjectModel } from './deck-designer/use-project-model'
import { useSelection, useSelectionState } from './deck-designer/use-selection'
import { useUndo } from './deck-designer/use-undo'
import { useCommands } from './deck-designer/use-commands'
import { useCanvasSettings } from './deck-designer/use-canvas-settings'
import { useCanvasSelection } from './deck-designer/use-canvas-selection'
import { useTransformGestures } from './deck-designer/use-transform-gestures'
import { useCanvasShortcuts } from './deck-designer/use-canvas-shortcuts'
import { SelectionGizmo } from './deck-designer/selection-gizmo'
import { SelectionMinibar } from './deck-designer/selection-minibar'
import './deck-designer/deck-designer.css'

export default function DeckDesignerPane() {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const commands = useCommands()
  const { snap, grid } = useCanvasSettings()
  const pageId = useMemo(() => model.pages()[0]!.id, [model])
  const canvas = model.page(pageId)?.canvas

  const surfaceRef = useRef<PanZoomHandle>(null)
  const [element, setElement] = useState<HTMLElement | null>(null)
  useEffect(() => setElement(surfaceRef.current?.getElement() ?? null), [])
  const getTransform = useCallback((): ViewTransform => surfaceRef.current?.getTransform() ?? IDENTITY, [])

  const { marquee, lasso } = useCanvasSelection({ element, getTransform, model, pageId, engine })
  const gestures = useTransformGestures({ model, engine, undo, pageId, element, getTransform, snapEnabled: snap, grid })
  const tool = useCanvasShortcuts({ element, model, engine, undo, commands })
  const selection = useSelectionState()
  const selectedIds = useMemo(
    () => new Set(selection.kind === 'widget' ? selection.ids : []),
    [selection],
  )

  return (
    <section className="dd-pane" data-pane="deck-designer" data-tool={tool} aria-label="Deck Designer workspace">
      <PanZoomSurface
        ref={surfaceRef}
        aria-label="Deck canvas"
        getFitBounds={() => (canvas?.w && canvas?.h ? { x: 0, y: 0, w: canvas.w, h: canvas.h } : null)}
        overlay={({ transform }) => <SelectionMinibar transform={transform} />}
      >
        <Board
          model={model}
          pageId={pageId}
          selectedIds={selectedIds}
          onWidgetPointerDown={gestures.onWidgetPointerDown}
        />
        <SelectionGizmo model={model} selection={selection} gestures={gestures} />
        {/* Smart guides render ONLY during a snapping gesture (CD-307). */}
        {gestures.guides.v.map((x) => (
          <div key={`v${x}`} className="dd-guide dd-guide-v" data-testid="guide-v" style={{ transform: `translateX(${x}px)` }} />
        ))}
        {gestures.guides.h.map((y) => (
          <div key={`h${y}`} className="dd-guide dd-guide-h" data-testid="guide-h" style={{ transform: `translateY(${y}px)` }} />
        ))}
        {marquee && (
          <div
            className="dd-marquee"
            data-testid="marquee"
            style={{ transform: `translate(${marquee.x}px, ${marquee.y}px)`, width: marquee.w, height: marquee.h }}
          />
        )}
        {lasso && lasso.length > 1 && (
          <svg className="dd-lasso" aria-hidden="true">
            <polygon points={lasso.map((p) => `${p.x},${p.y}`).join(' ')} />
          </svg>
        )}
      </PanZoomSurface>
    </section>
  )
}
