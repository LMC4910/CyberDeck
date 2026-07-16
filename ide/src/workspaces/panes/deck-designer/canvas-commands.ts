// Canvas authoring operations (CD-308). Pure functions over (model, engine, undo)
// that the selection minibar and command registry both invoke — every minibar
// action is one of these, registered as a command (AC: "minibar actions are
// registry commands"). Each records a single undo entry.
import { isContainer, childIdsOf, type ProjectModel, type WidgetInstance } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import type { CommandRegistry } from '@/platform/commands'
import { boundingFrame } from './transform-math'

export interface CanvasCtx {
  model: ProjectModel
  engine: SelectionEngine
  undo: UndoStack
}

/** Canvas command ids — the minibar and palette dispatch these (AUDIT: one source). */
export const CANVAS_COMMANDS = {
  duplicate: 'canvas.duplicate',
  lock: 'canvas.lock',
  group: 'canvas.group',
  ungroup: 'canvas.ungroup',
  delete: 'canvas.delete',
} as const

const OFFSET = 16

function selectedWidgets(model: ProjectModel, engine: SelectionEngine): WidgetInstance[] {
  return engine.state.ids.map((id) => model.widget(id)).filter((w): w is WidgetInstance => !!w)
}

/** Deep-clone a widget subtree with fresh ids + remapped container childIds. */
function cloneSubtree(model: ProjectModel, rootId: string): { clones: WidgetInstance[]; newRootId: string } {
  const idMap = new Map<string, string>()
  const collect = (id: string) => {
    idMap.set(id, model.newId('widget'))
    const w = model.widget(id)
    if (w && isContainer(w)) for (const c of childIdsOf(w)) collect(c)
  }
  collect(rootId)
  const clones = [...idMap.keys()].map((oldId) => {
    const w = model.widget(oldId)!
    const c = structuredClone(w)
    c.id = idMap.get(oldId)!
    c.frame = { ...w.frame, x: w.frame.x + OFFSET, y: w.frame.y + OFFSET }
    if (isContainer(w)) c.config = { ...(c.config as object), childIds: childIdsOf(w).map((cid) => idMap.get(cid)!) }
    return c
  })
  return { clones, newRootId: idMap.get(rootId)! }
}

/** Duplicate the selection (offset +16,+16); selects the copies. One undo entry. */
export function duplicateSelection({ model, engine, undo }: CanvasCtx): void {
  const roots = selectedWidgets(model, engine)
  if (roots.length === 0) return
  const pageId = model.pageOf(roots[0]!.id)
  if (!pageId) return
  const batches = roots.map((w) => cloneSubtree(model, w.id))
  undo.execUndoable('Duplicate', () => {
    const inverses = batches.flatMap((b) => b.clones.map((c) => model.addWidget(pageId, c)))
    return () => inverses.reverse().forEach((inv) => inv())
  })
  engine.selectMany(batches.map((b) => b.newRootId))
}

/** Toggle lock on the selection (locks if any is unlocked). One undo entry. */
export function toggleLockSelection({ model, engine, undo }: CanvasCtx): void {
  const widgets = selectedWidgets(model, engine)
  if (widgets.length === 0) return
  const lock = widgets.some((w) => !w.locked)
  undo.execUndoable(lock ? 'Lock' : 'Unlock', () => {
    const inverses = widgets.map((w) => model.setLocked(w.id, lock))
    return () => inverses.reverse().forEach((inv) => inv())
  })
}

/** Group the selection into a container; selects the group. One undo entry. */
export function groupSelection({ model, engine, undo }: CanvasCtx): void {
  const ids = engine.state.ids.filter((id) => model.widget(id))
  if (ids.length < 2) return
  const pageId = model.pageOf(ids[0]!)
  if (!pageId) return
  const box = boundingFrame(ids.map((id) => model.widget(id)!.frame))
  if (!box) return
  const groupId = model.newId('group')
  undo.execUndoable('Group', () => model.group(pageId, groupId, ids, box))
  engine.selectOnly(groupId)
}

/** Ungroup the selected container(s). One undo entry. */
export function ungroupSelection({ model, engine, undo }: CanvasCtx): void {
  const containers = selectedWidgets(model, engine).filter((w) => isContainer(w))
  if (containers.length === 0) return
  undo.execUndoable('Ungroup', () => {
    const inverses = containers.map((c) => model.ungroup(c.id))
    return () => inverses.reverse().forEach((inv) => inv())
  })
}

/** Delete the selection (cascading containers); clears the selection. One undo entry. */
export function deleteSelection({ model, engine, undo }: CanvasCtx): void {
  const ids = engine.state.ids.filter((id) => model.widget(id))
  if (ids.length === 0) return
  undo.execUndoable('Delete', () => {
    const inverses = ids.map((id) => model.removeWidget(id))
    return () => inverses.reverse().forEach((inv) => inv())
  })
  engine.clear()
}

/**
 * Register the canvas commands on the shared registry (CD-308). `getCtx` resolves
 * the live model/selection/undo at execution time (the project model changes when a
 * project is opened). Returns the registered command ids.
 */
export function registerCanvasCommands(commands: CommandRegistry, getCtx: () => CanvasCtx | null): void {
  const run = (fn: (ctx: CanvasCtx) => void) => () => {
    const ctx = getCtx()
    if (ctx) fn(ctx)
  }
  commands.register({ id: CANVAS_COMMANDS.duplicate, category: 'Edit', label: 'Duplicate', icon: 'copy', handler: run(duplicateSelection) })
  commands.register({ id: CANVAS_COMMANDS.lock, category: 'Edit', label: 'Lock / Unlock', icon: 'lock', handler: run(toggleLockSelection) })
  commands.register({ id: CANVAS_COMMANDS.group, category: 'Edit', label: 'Group', icon: 'group', handler: run(groupSelection) })
  commands.register({ id: CANVAS_COMMANDS.ungroup, category: 'Edit', label: 'Ungroup', icon: 'ungroup', handler: run(ungroupSelection) })
  commands.register({ id: CANVAS_COMMANDS.delete, category: 'Edit', label: 'Delete', icon: 'trash', handler: run(deleteSelection) })
}
