import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { createComponentFromSelection, instantiateComponent, addVariant, swapVariant, cycleVariant, deleteVariantAndRemap, findInstances } from './component-ops'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 60, h: 40 } }
}

function setup() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'V' },
    pages: [{ id: 'page_vartst', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa', 0), w('w_bbbbbb', 100)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const ctx = { model, engine, undo, pageId: 'page_vartst' }
  // component + two instances
  engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
  const componentId = createComponentFromSelection(ctx, 'Card')!
  const inst1 = findInstances(model, componentId)[0]!
  const inst2 = instantiateComponent(ctx, componentId, { x: 400, y: 300 })!
  return { model, engine, undo, ctx, componentId, inst1, inst2 }
}

describe('variants (CD-317)', () => {
  it('swap is per-instance (siblings unaffected)', () => {
    const { model, ctx, componentId, inst1, inst2 } = setup()
    const va = addVariant(ctx, componentId, 'Compact')!
    swapVariant(ctx, inst1, va)
    expect(model.widget(inst1)!.variant).toBe(va)
    expect(model.widget(inst2)!.variant).toBeUndefined() // sibling untouched
  })

  it('swap + add variant are undoable', () => {
    const { model, undo, ctx, componentId, inst1 } = setup()
    const va = addVariant(ctx, componentId, 'Compact')!
    swapVariant(ctx, inst1, va)
    undo.undo() // undo swap
    expect(model.widget(inst1)!.variant).toBeUndefined()
    undo.undo() // undo add variant
    expect(model.component(componentId)!.variants ?? []).toHaveLength(0)
  })

  it(',/. cycles the instance variant', () => {
    const { model, ctx, componentId, inst1 } = setup()
    const a = addVariant(ctx, componentId, 'A')!
    const b = addVariant(ctx, componentId, 'B')!
    cycleVariant(ctx, inst1, 1)
    expect(model.widget(inst1)!.variant).toBe(a)
    cycleVariant(ctx, inst1, 1)
    expect(model.widget(inst1)!.variant).toBe(b)
    cycleVariant(ctx, inst1, 1) // wrap
    expect(model.widget(inst1)!.variant).toBe(a)
  })

  it('deleting a variant remaps affected instances to the first remaining one', () => {
    const { model, ctx, componentId, inst1, inst2 } = setup()
    const a = addVariant(ctx, componentId, 'A')!
    const b = addVariant(ctx, componentId, 'B')!
    swapVariant(ctx, inst1, a)
    swapVariant(ctx, inst2, a)
    deleteVariantAndRemap(ctx, componentId, a)
    // a is gone; both instances remapped to the remaining variant (b)
    expect(model.component(componentId)!.variants!.map((v) => v.id)).toEqual([b])
    expect(model.widget(inst1)!.variant).toBe(b)
    expect(model.widget(inst2)!.variant).toBe(b)
    expect(model.validate()).toEqual([])
  })

  it('delete-remap is one undoable step', () => {
    const { model, undo, ctx, componentId, inst1 } = setup()
    const a = addVariant(ctx, componentId, 'A')!
    swapVariant(ctx, inst1, a)
    const before = model.snapshot()
    deleteVariantAndRemap(ctx, componentId, a)
    undo.undo()
    expect(model.snapshot()).toEqual(before)
  })
})
