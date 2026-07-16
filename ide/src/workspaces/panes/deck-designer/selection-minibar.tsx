// Selection minibar (CD-308). A floating toolbar that tracks the selection at
// CONSTANT screen size — it lives in the surface's screen-space overlay, so it never
// scales with zoom. Every action dispatches a registered canvas command (AC). It
// follows the selection live during drags via the model revision.
import { useSyncExternalStore } from 'react'
import { worldToScreen, type ViewTransform } from '@/shared/canvas'
import { isContainer, type ProjectModel } from '@/shared/project'
import { useProjectModel } from './use-project-model'
import { useSelectionState } from './use-selection'
import { useCommands } from './use-commands'
import { CANVAS_COMMANDS } from './canvas-commands'
import { boundingFrame } from './transform-math'

/** Re-render on ANY model change so the bar follows moving/ resizing widgets. */
function useModelRevision(model: ProjectModel): number {
  return useSyncExternalStore(
    (cb) => model.subscribe(cb),
    () => model.revision,
  )
}

export function SelectionMinibar({ transform }: { transform: ViewTransform }) {
  const model = useProjectModel()
  const selection = useSelectionState()
  const commands = useCommands()
  useModelRevision(model)

  if (selection.kind !== 'widget' || selection.ids.length === 0) return null
  const frames = selection.ids.map((id) => model.widget(id)?.frame).filter((f): f is NonNullable<typeof f> => !!f)
  const box = boundingFrame(frames)
  if (!box) return null

  const topCenter = worldToScreen(transform, { x: box.x + box.w / 2, y: box.y })
  const multi = selection.ids.length > 1
  const anyContainer = selection.ids.some((id) => {
    const w = model.widget(id)
    return w && isContainer(w)
  })

  const run = (id: string) => () => void commands.execute(id, undefined, {})

  return (
    <div
      className="dd-minibar"
      role="toolbar"
      aria-label="Selection actions"
      data-testid="selection-minibar"
      style={{ left: topCenter.x, top: topCenter.y, transform: 'translate(-50%, calc(-100% - 10px))' }}
    >
      <button type="button" data-action="duplicate" aria-label="Duplicate" title="Duplicate" onClick={run(CANVAS_COMMANDS.duplicate)}>⧉</button>
      <button type="button" data-action="lock" aria-label="Lock or unlock" title="Lock / Unlock" onClick={run(CANVAS_COMMANDS.lock)}>🔒</button>
      {multi && (
        <button type="button" data-action="group" aria-label="Group" title="Group" onClick={run(CANVAS_COMMANDS.group)}>▢</button>
      )}
      {anyContainer && (
        <button type="button" data-action="ungroup" aria-label="Ungroup" title="Ungroup" onClick={run(CANVAS_COMMANDS.ungroup)}>◫</button>
      )}
      <button type="button" data-action="delete" aria-label="Delete" title="Delete" onClick={run(CANVAS_COMMANDS.delete)}>🗑</button>
    </div>
  )
}
