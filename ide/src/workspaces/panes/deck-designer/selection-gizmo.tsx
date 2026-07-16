// Selection gizmo (CD-306). Renders the transform handles over the selection in
// world coordinates: for a single widget, 8 resize handles + a rotate handle; for a
// multi-selection, just the bounding outline (drag moves the group; per-widget
// resize is single-selection). Handles fire the gesture controllers.
import { memo } from 'react'
import type { ProjectModel } from '@/shared/project'
import { RESIZE_HANDLES, boundingFrame, type ResizeHandle } from './transform-math'
import { useWidget } from './use-project-model'
import type { TransformGestures } from './use-transform-gestures'
import type { SelectionState } from '@/stores'

interface Props {
  model: ProjectModel
  selection: SelectionState
  gestures: TransformGestures
}

export function SelectionGizmo({ model, selection, gestures }: Props) {
  if (selection.kind !== 'widget' || selection.ids.length === 0) return null
  if (selection.ids.length === 1) {
    return <SingleGizmo model={model} id={selection.ids[0]!} gestures={gestures} />
  }
  return <MultiOutline model={model} ids={selection.ids} />
}

const SingleGizmo = memo(function SingleGizmo({
  model,
  id,
  gestures,
}: {
  model: ProjectModel
  id: string
  gestures: TransformGestures
}) {
  const widget = useWidget(model, id)
  if (!widget) return null
  const { frame } = widget
  const locked = widget.locked
  return (
    <div
      className="dd-gizmo"
      data-testid="selection-gizmo"
      style={{ transform: `translate(${frame.x}px, ${frame.y}px)`, width: frame.w, height: frame.h }}
    >
      <div className="dd-gizmo-outline" aria-hidden="true" />
      {!locked && (
        <>
          <button
            type="button"
            className="dd-rotate-handle"
            data-handle="rotate"
            aria-label="Rotate"
            onPointerDown={(e) => gestures.beginRotate(e)}
          />
          {RESIZE_HANDLES.map((h) => (
            <button
              key={h}
              type="button"
              className={`dd-handle dd-handle-${h}`}
              data-handle={h}
              aria-label={`Resize ${h}`}
              onPointerDown={(e) => gestures.beginResize(h as ResizeHandle, e)}
            />
          ))}
        </>
      )}
    </div>
  )
})

function MultiOutline({ model, ids }: { model: ProjectModel; ids: string[] }) {
  const frames = ids.map((id) => model.widget(id)?.frame).filter((f): f is NonNullable<typeof f> => !!f)
  const box = boundingFrame(frames)
  if (!box) return null
  return (
    <div
      className="dd-gizmo dd-gizmo-multi"
      data-testid="selection-gizmo-multi"
      style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
    >
      <div className="dd-gizmo-outline" aria-hidden="true" />
    </div>
  )
}
