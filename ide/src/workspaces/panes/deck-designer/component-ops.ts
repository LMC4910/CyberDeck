// Component operations (CD-316). Create a component from a selection, instantiate it
// (deep copy w/ fresh ids + master link), and detach an instance back to plain
// widgets. Every op is one undoable step. Master↔instance links are ID-keyed (never
// name-derived), so they survive rename/duplicate.
//
// Authoring representation: an instance is ONE WidgetInstance carrying `component`
// (+ later `variant`/`overrides`); the master's template widgets live in the
// component def (frames relative to the component origin). The board previews the
// template inside the instance frame; publish (M5) expands it to plain widgets.
import { boundingFrame } from './transform-math'
import type { ProjectModel, WidgetInstance, ComponentDef, Frame } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'

export const INSTANCE_TYPE = 'core.instance'

export interface CompCtx {
  model: ProjectModel
  engine: SelectionEngine
  undo: UndoStack
  pageId: string
}

/** All instance widgets on any page that reference `componentId`. */
export function findInstances(model: ProjectModel, componentId: string): string[] {
  const out: string[] = []
  for (const p of model.pages()) {
    for (const w of p.widgets) if (w.component === componentId) out.push(w.id)
  }
  return out
}

function templateBounds(def: ComponentDef): Frame {
  return boundingFrame(def.widgets.map((w) => w.frame)) ?? { x: 0, y: 0, w: 100, h: 100 }
}

/** Clone template widgets to fresh ids, offset from the component origin to `at`. */
function expandTemplate(model: ProjectModel, def: ComponentDef, at: { x: number; y: number }): WidgetInstance[] {
  return def.widgets.map((t) => {
    const c = structuredClone(t)
    c.id = model.newId('widget')
    c.frame = { ...t.frame, x: t.frame.x + at.x, y: t.frame.y + at.y }
    return c
  })
}

/**
 * Create a component from the current widget selection. The selected widgets become
 * the master template (frames relative to their bounding-box origin); they are
 * replaced on the page by a single instance. Returns the new component id.
 */
export function createComponentFromSelection(ctx: CompCtx, name = 'Component'): string | null {
  const { model, engine, undo, pageId } = ctx
  const ids = engine.state.ids.filter((id) => model.widget(id))
  if (ids.length === 0) return null
  const widgets = ids.map((id) => model.widget(id)!)
  const box = boundingFrame(widgets.map((w) => w.frame))!
  const componentId = model.newId('component')
  const instanceId = model.newId('widget')

  // Template: the selected widgets, frames relative to the box origin.
  const template: WidgetInstance[] = widgets.map((w) => ({
    ...structuredClone(w),
    frame: { ...w.frame, x: w.frame.x - box.x, y: w.frame.y - box.y },
  }))
  const def: ComponentDef = { id: componentId, name, widgets: template as [WidgetInstance, ...WidgetInstance[]] }
  const instance: WidgetInstance = {
    id: instanceId,
    type: INSTANCE_TYPE,
    name,
    frame: { ...box },
    component: componentId,
  }

  undo.execUndoable('Create component', () => {
    const removed = ids.map((id) => model.removeWidget(id))
    const addedDef = model.addComponent(def)
    const addedInst = model.addWidget(pageId, instance)
    return () => {
      addedInst()
      addedDef()
      removed.reverse().forEach((inv) => inv())
    }
  })
  engine.selectOnly(instanceId)
  return componentId
}

/** Instantiate a component centered on `center`. Returns the new instance id. */
export function instantiateComponent(ctx: CompCtx, componentId: string, center: { x: number; y: number }): string | null {
  const { model, engine, undo, pageId } = ctx
  const def = model.component(componentId)
  if (!def) return null
  const b = templateBounds(def)
  const instanceId = model.newId('widget')
  const instance: WidgetInstance = {
    id: instanceId,
    type: INSTANCE_TYPE,
    name: def.name,
    frame: { x: Math.round(center.x - b.w / 2), y: Math.round(center.y - b.h / 2), w: b.w, h: b.h },
    component: componentId,
  }
  undo.execUndoable(`Insert ${def.name}`, () => model.addWidget(pageId, instance))
  engine.selectOnly(instanceId)
  return instanceId
}

// ── variants (CD-317) ─────────────────────────────────────────────────────────
/** Add a variant to a component (undoable). Returns the new variant id. */
export function addVariant(ctx: CompCtx, componentId: string, name: string): string | null {
  const { model, undo } = ctx
  if (!model.component(componentId)) return null
  const variantId = model.newId('variant')
  undo.execUndoable('Add variant', () => model.addVariant(componentId, { id: variantId, name }))
  return variantId
}

/** Swap ONE instance's variant (per-instance; never touches siblings). Undoable. */
export function swapVariant(ctx: CompCtx, instanceId: string, variantId: string | undefined): void {
  const { model, undo } = ctx
  undo.execUndoable('Swap variant', () => model.setVariant(instanceId, variantId))
}

/** Cycle an instance's variant (,/. keys). Undoable. */
export function cycleVariant(ctx: CompCtx, instanceId: string, dir: 1 | -1): void {
  const { model } = ctx
  const inst = model.widget(instanceId)
  const def = inst?.component ? model.component(inst.component) : undefined
  const variants = def?.variants ?? []
  if (variants.length === 0) return
  const cur = variants.findIndex((v) => v.id === inst!.variant)
  const next = (((cur < 0 ? -dir : cur) + dir) + variants.length) % variants.length
  swapVariant(ctx, instanceId, variants[next]!.id)
}

/**
 * Delete a variant and remap every affected instance to the first remaining variant
 * (or clear it if none remain). One undo entry.
 */
export function deleteVariantAndRemap(ctx: CompCtx, componentId: string, variantId: string): void {
  const { model, undo } = ctx
  const def = model.component(componentId)
  if (!def) return
  const remaining = (def.variants ?? []).filter((v) => v.id !== variantId)
  const fallback = remaining[0]?.id
  const affected: string[] = []
  for (const p of model.pages()) {
    for (const w of p.widgets) if (w.component === componentId && w.variant === variantId) affected.push(w.id)
  }
  undo.execUndoable('Delete variant', () => {
    const inverses = affected.map((id) => model.setVariant(id, fallback))
    inverses.push(model.removeVariant(componentId, variantId))
    return () => inverses.reverse().forEach((inv) => inv())
  })
}

/** Detach an instance: replace it with fresh copies of the master template. */
export function detachInstance(ctx: CompCtx, instanceId: string): string[] {
  const { model, engine, undo, pageId } = ctx
  const inst = model.widget(instanceId)
  if (!inst?.component) return []
  const def = model.component(inst.component)
  if (!def) return []
  const copies = expandTemplate(model, def, { x: inst.frame.x, y: inst.frame.y })
  undo.execUndoable('Detach instance', () => {
    const removed = model.removeWidget(instanceId)
    const added = copies.map((c) => model.addWidget(pageId, c))
    return () => {
      added.reverse().forEach((inv) => inv())
      removed()
    }
  })
  engine.selectMany(copies.map((c) => c.id))
  return copies.map((c) => c.id)
}
