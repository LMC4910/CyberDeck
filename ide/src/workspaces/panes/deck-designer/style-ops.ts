// Shared style operations (CD-321). A style is a named, kinded bag of props in the
// document's `styles` registry; widgets link a style per kind via config.styles[kind]
// = styleId. Editing a style propagates to EVERY linked widget because widgets
// resolve their appearance from the registry (effectiveStyleProps), never a copy.
import type { ProjectModel, WidgetInstance, StyleKind } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'

export const STYLE_KINDS: { kind: StyleKind; label: string; props: string[] }[] = [
  { kind: 'fill', label: 'Fill', props: ['color'] },
  { kind: 'stroke', label: 'Stroke', props: ['color', 'width'] },
  { kind: 'typography', label: 'Typography', props: ['size', 'weight', 'family'] },
  { kind: 'effect', label: 'Effect', props: ['shadow'] },
  { kind: 'radius', label: 'Radius', props: ['radius'] },
]

export interface StyleCtx {
  model: ProjectModel
  undo: UndoStack
  engine: SelectionEngine
}

export function linkedStyleId(w: WidgetInstance, kind: StyleKind): string | undefined {
  return (w.config as { styles?: Record<string, string> } | undefined)?.styles?.[kind]
}

/** The effective props for a widget's `kind` appearance, resolved from its linked style. */
export function effectiveStyleProps(model: ProjectModel, w: WidgetInstance, kind: StyleKind): Record<string, unknown> {
  const id = linkedStyleId(w, kind)
  const s = id ? model.style(id) : undefined
  return (s?.props ?? {}) as Record<string, unknown>
}

/** Create a shared style and link the widget to it (undoable). Returns the style id. */
export function newStyleFromWidget(ctx: StyleCtx, widgetId: string, kind: StyleKind, name: string): string | null {
  const { model, undo } = ctx
  const w = model.widget(widgetId)
  if (!w) return null
  const styleId = model.newId('style')
  const seed = (w.config as Record<string, unknown> | undefined)?.[kind]
  const props = seed && typeof seed === 'object' ? { ...(seed as Record<string, unknown>) } : {}
  undo.execUndoable('New style', () => {
    const added = model.addStyle(styleId, { kind, name, props })
    const linked = model.linkStyle(widgetId, kind, styleId)
    return () => {
      linked()
      added()
    }
  })
  return styleId
}

export function linkStyle(ctx: StyleCtx, widgetId: string, kind: StyleKind, styleId: string): void {
  ctx.undo.execUndoable('Link style', () => ctx.model.linkStyle(widgetId, kind, styleId))
}

export function unlinkStyle(ctx: StyleCtx, widgetId: string, kind: StyleKind): void {
  ctx.undo.execUndoable('Detach style', () => ctx.model.unlinkStyle(widgetId, kind))
}

export function setStyleProp(ctx: StyleCtx, styleId: string, prop: string, value: unknown): void {
  ctx.undo.execUndoable('Edit style', () => ctx.model.setStyleProp(styleId, prop, value), { coalesceKey: `style:${styleId}:${prop}` })
}

/** Style ids of a given kind (for the link picker). */
export function stylesOfKind(model: ProjectModel, kind: StyleKind): { id: string; name: string }[] {
  return Object.entries(model.styles())
    .filter(([, s]) => s.kind === kind)
    .map(([id, s]) => ({ id, name: s.name }))
}
