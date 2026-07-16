// Binding operations (CD-324). Bindings live in the document (doc.bindings[widgetId]
// [prop] = { mode, src?, expr?, val? }), so they persist + restore with the project.
// All mutations are undoable; the popover + inspector call these.
import type { ProjectModel, Binding } from '@/shared/project'
import type { UndoStack } from '@/platform/undo'

/** Props the inspector exposes as bindable (CD-324). */
export const BINDABLE_PROPS = ['value', 'text', 'color', 'visible', 'min', 'max'] as const

export interface BindCtx {
  model: ProjectModel
  undo: UndoStack
}

export function setBinding(ctx: BindCtx, widgetId: string, prop: string, binding: Binding): void {
  ctx.undo.execUndoable('Bind', () => ctx.model.setBinding(widgetId, prop, binding))
}

export function clearBinding(ctx: BindCtx, widgetId: string, prop: string): void {
  ctx.undo.execUndoable('Unbind', () => ctx.model.clearBinding(widgetId, prop))
}

/** A short human label for a binding chip. */
export function bindingLabel(b: Binding): string {
  switch (b.mode) {
    case 'variable': return `= ${b.src ?? '?'}`
    case 'expression': return `ƒ ${b.expr ?? ''}`
    case 'static': return `${formatVal(b.val)}`
    default: return '—'
  }
}

function formatVal(v: unknown): string {
  if (v && typeof v === 'object' && 'v' in (v as Record<string, unknown>)) return String((v as { v: unknown }).v)
  return String(v ?? '')
}

/** True if the widget has any binding (for the canvas bind-dot). */
export function hasAnyBinding(model: ProjectModel, widgetId: string): boolean {
  const b = model.bindingsOf(widgetId)
  return !!b && Object.keys(b).length > 0
}
