// Board render (CD-303). Renders widgets from the ProjectModel — the model is the
// source of truth, never the DOM. Each widget is a positioned frame with chrome
// (frame border, selection ring, lock badge). A model change repaints only the
// affected <WidgetView> (see use-project-model). Actual widget bodies are the widget
// platform's job (M4); here each widget shows an honest type/name placeholder.
import { memo } from 'react'
import { GROUP_TYPE, isContainer, type ProjectModel, type WidgetInstance } from '@/shared/project'
import { useAllWidgetIds, useWidget } from './use-project-model'
import './board.css'

export interface BoardProps {
  model: ProjectModel
  pageId: string
  /** Currently-selected widget ids (selection engine arrives at CD-305). */
  selectedIds?: ReadonlySet<string>
  /** Notified when a widget renders — used by the render-count test + telemetry. */
  onWidgetRender?: (id: string) => void
  /** Pointer-down on a widget (selection wiring lands at CD-305). */
  onWidgetPointerDown?: (id: string, e: React.PointerEvent) => void
}

export function Board({ model, pageId, selectedIds, onWidgetRender, onWidgetPointerDown }: BoardProps) {
  const ids = useAllWidgetIds(model, pageId)
  const page = model.page(pageId)
  const canvas = page?.canvas
  return (
    <div
      className="dd-board"
      data-board={pageId}
      role="group"
      aria-label={`Canvas — ${page?.name ?? 'page'}`}
      style={canvas ? { width: canvas.w, height: canvas.h } : undefined}
    >
      {ids.map((id) => (
        <WidgetView
          key={id}
          model={model}
          id={id}
          selected={selectedIds?.has(id) ?? false}
          onRender={onWidgetRender}
          onPointerDown={onWidgetPointerDown}
        />
      ))}
    </div>
  )
}

interface WidgetViewProps {
  model: ProjectModel
  id: string
  selected: boolean
  onRender?: (id: string) => void
  onPointerDown?: (id: string, e: React.PointerEvent) => void
}

const WidgetView = memo(function WidgetView({ model, id, selected, onRender, onPointerDown }: WidgetViewProps) {
  const widget = useWidget(model, id)
  // Report the paint AFTER the model read so the render-count test sees one call
  // per actual re-render of this view.
  onRender?.(id)
  if (!widget) return null

  const { frame } = widget
  const container = isContainer(widget)
  const cfg = widget.config as { rotation?: number; opacity?: number; hidden?: boolean } | undefined
  if (cfg?.hidden) return null // hidden via the layers panel (CD-310)
  const rotation = typeof cfg?.rotation === 'number' ? cfg.rotation : 0
  const opacity = typeof cfg?.opacity === 'number' ? cfg.opacity : undefined
  const transform =
    `translate(${frame.x}px, ${frame.y}px)` + (rotation ? ` rotate(${rotation}deg)` : '')
  return (
    <div
      className="dd-widget"
      data-widget={id}
      data-type={widget.type}
      data-selected={selected || undefined}
      data-locked={widget.locked || undefined}
      data-container={container || undefined}
      role="figure"
      aria-label={widget.name ?? widget.type}
      style={{ transform, width: frame.w, height: frame.h, opacity }}
      onPointerDown={onPointerDown ? (e) => onPointerDown(id, e) : undefined}
    >
      <WidgetBody widget={widget} />
      {selected && <div className="dd-widget-ring" aria-hidden="true" />}
      {widget.locked && (
        <div className="dd-widget-lock" aria-hidden="true" title="Locked">
          🔒
        </div>
      )}
    </div>
  )
})

/** Honest placeholder body — real widget rendering is the widget platform (M4). */
function WidgetBody({ widget }: { widget: WidgetInstance }) {
  if (widget.type === GROUP_TYPE) {
    return <div className="dd-widget-group-label">{widget.name ?? 'Group'}</div>
  }
  const kind = widget.type.split('.')[0] ?? widget.type
  return (
    <div className="dd-widget-body">
      <span className="dd-widget-kind">{kind}</span>
      {widget.name && <span className="dd-widget-name">{widget.name}</span>}
    </div>
  )
}
