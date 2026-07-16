// Widget states (CD-327). Per-widget state set (Default + Hover/Pressed/Focus/
// Disabled + custom). Each non-default state stores a delta (opacity/scale/glow…) in
// doc.states[widgetId].ov[state]; the authoring "active" state previews it live on
// canvas. Persists + restores with the document; every edit is undoable.
import type { ProjectModel } from '@/shared/project'
import type { UndoStack } from '@/platform/undo'

export const STANDARD_STATES = ['default', 'hover', 'pressed', 'focus', 'disabled'] as const
export type StandardState = (typeof STANDARD_STATES)[number]

export const STATE_DELTA_FIELDS: { prop: string; label: string; min: number; max: number; step: number; def: number }[] = [
  { prop: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.1, def: 1 },
  { prop: 'scale', label: 'Scale', min: 0.2, max: 2, step: 0.05, def: 1 },
  { prop: 'glow', label: 'Glow', min: 0, max: 40, step: 1, def: 0 },
]

export interface StateCtx {
  model: ProjectModel
  undo: UndoStack
}

/** All states for a widget: the standard set plus any custom ones. */
export function allStates(model: ProjectModel, widgetId: string): string[] {
  const custom = model.stateOf(widgetId)?.custom ?? []
  return [...STANDARD_STATES, ...custom.filter((c) => !STANDARD_STATES.includes(c as StandardState))]
}

/** The currently-previewed (active) state, or 'default'. */
export function activeState(model: ProjectModel, widgetId: string): string {
  return model.stateOf(widgetId)?.active ?? 'default'
}

/** The per-state delta object (opacity/scale/glow). */
export function stateDelta(model: ProjectModel, widgetId: string, state: string): Record<string, unknown> {
  return (model.stateOf(widgetId)?.ov?.[state] ?? {}) as Record<string, unknown>
}

export function setActive(ctx: StateCtx, widgetId: string, state: string): void {
  ctx.undo.execUndoable('Preview state', () => ctx.model.setActiveState(widgetId, state === 'default' ? undefined : state))
}

export function setDelta(ctx: StateCtx, widgetId: string, state: string, prop: string, value: number): void {
  ctx.undo.execUndoable('State delta', () => ctx.model.setStateOverride(widgetId, state, prop, value), { coalesceKey: `state:${widgetId}:${state}:${prop}` })
}

export function addCustomState(ctx: StateCtx, widgetId: string, name: string): void {
  const custom = ctx.model.stateOf(widgetId)?.custom ?? []
  if (custom.includes(name) || STANDARD_STATES.includes(name as StandardState)) return
  ctx.undo.execUndoable('Add state', () => ctx.model.setCustomStates(widgetId, [...custom, name]))
}

export function removeCustomState(ctx: StateCtx, widgetId: string, name: string): void {
  const st = ctx.model.stateOf(widgetId)
  const custom = st?.custom ?? []
  if (!custom.includes(name)) return
  ctx.undo.execUndoable('Remove state', () => {
    const inv = ctx.model.setCustomStates(widgetId, custom.filter((c) => c !== name))
    // also drop any delta + deselect if active
    const delInv = Object.keys(st?.ov?.[name] ?? {}).map((p) => ctx.model.setStateOverride(widgetId, name, p, undefined))
    const activeInv = st?.active === name ? [ctx.model.setActiveState(widgetId, undefined)] : []
    return () => {
      activeInv.forEach((f) => f())
      delInv.reverse().forEach((f) => f())
      inv()
    }
  })
}
