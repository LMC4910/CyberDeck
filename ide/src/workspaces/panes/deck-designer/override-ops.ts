// Per-instance overrides (CD-318). Overrides live on the instance widget's
// `overrides` map (keyed by the instance id — never name-derived), so setting one
// NEVER touches the master or sibling instances. The effective value of a prop is
//   instance override ← variant override ← component master default (left overrides).
import type { ProjectModel, WidgetInstance } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'

export interface OverrideCtx {
  model: ProjectModel
  undo: UndoStack
  engine: SelectionEngine
}

/** The overridable slots surfaced in the inspector (CD-318). */
export const OVERRIDE_FIELDS: { prop: string; label: string; kind: 'text' | 'color' | 'number' | 'toggle' }[] = [
  { prop: 'text', label: 'Text', kind: 'text' },
  { prop: 'icon', label: 'Icon', kind: 'text' },
  { prop: 'color', label: 'Color', kind: 'color' },
  { prop: 'padding', label: 'Padding', kind: 'number' },
  { prop: 'visible', label: 'Visible', kind: 'toggle' },
]

function overridesOf(w: WidgetInstance): Record<string, unknown> {
  return (w.overrides ?? {}) as Record<string, unknown>
}

/** The value a prop resolves to WITHOUT the instance override (variant → master). */
export function masterValue(model: ProjectModel, instance: WidgetInstance, prop: string): unknown {
  const def = instance.component ? model.component(instance.component) : undefined
  if (!def) return undefined
  const variant = instance.variant ? def.variants?.find((v) => v.id === instance.variant) : undefined
  const variantOv = (variant?.overrides ?? {}) as Record<string, unknown>
  if (prop in variantOv) return variantOv[prop]
  const props = (def.props ?? {}) as Record<string, unknown>
  return props[prop]
}

/** The effective value: instance override, else the master value. */
export function effectiveValue(model: ProjectModel, instance: WidgetInstance, prop: string): unknown {
  const ov = overridesOf(instance)
  return prop in ov ? ov[prop] : masterValue(model, instance, prop)
}

export function isOverridden(instance: WidgetInstance, prop: string): boolean {
  return prop in overridesOf(instance)
}

export function overrideCount(instance: WidgetInstance): number {
  return Object.keys(overridesOf(instance)).length
}

export function setInstanceOverride(ctx: OverrideCtx, instanceId: string, prop: string, value: unknown): void {
  ctx.undo.execUndoable('Override', () => ctx.model.setOverride(instanceId, prop, value), { coalesceKey: `ov:${instanceId}:${prop}` })
}

export function revertOverride(ctx: OverrideCtx, instanceId: string, prop: string): void {
  ctx.undo.execUndoable('Revert override', () => ctx.model.clearOverride(instanceId, prop))
}

/** Clear every override on an instance in one undo entry. */
export function resetAllOverrides(ctx: OverrideCtx, instanceId: string): void {
  const inst = ctx.model.widget(instanceId)
  if (!inst) return
  const props = Object.keys(overridesOf(inst))
  if (props.length === 0) return
  ctx.undo.execUndoable('Reset overrides', () => {
    const inverses = props.map((p) => ctx.model.clearOverride(instanceId, p))
    return () => inverses.reverse().forEach((inv) => inv())
  })
}
