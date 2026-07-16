import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { createComponentFromSelection, instantiateComponent, findInstances } from './component-ops'
import { setInstanceOverride, revertOverride, resetAllOverrides, effectiveValue, masterValue, overrideCount, isOverridden } from './override-ops'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'button.action', frame: { x, y: 0, w: 60, h: 40 } }
}

function setup() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'O' },
    pages: [{ id: 'page_ovrtst', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa', 0)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const ctx = { model, engine, undo, pageId: 'page_ovrtst' }
  engine.selectOnly('w_aaaaaa')
  const componentId = createComponentFromSelection(ctx, 'Btn')!
  // give the master a default so revert has something to fall back to
  model.component(componentId)!.props = { text: 'Master' }
  const inst1 = findInstances(model, componentId)[0]!
  const inst2 = instantiateComponent(ctx, componentId, { x: 300, y: 200 })!
  return { model, engine, undo, ctx: { model, undo, engine }, componentId, inst1, inst2 }
}

describe('overrides (CD-318)', () => {
  it('override isolation: mutating an instance never changes master or siblings', () => {
    const { model, componentId, inst1, inst2, ctx } = setup()
    setInstanceOverride(ctx, inst1, 'text', 'Only me')
    // instance changed
    expect(effectiveValue(model, model.widget(inst1)!, 'text')).toBe('Only me')
    // master default untouched
    expect((model.component(componentId)!.props as { text: string }).text).toBe('Master')
    // sibling still resolves to master
    expect(effectiveValue(model, model.widget(inst2)!, 'text')).toBe('Master')
    expect(isOverridden(model.widget(inst2)!, 'text')).toBe(false)
  })

  it('revert removes the override and restores the master value (undoable)', () => {
    const { model, undo, inst1, ctx } = setup()
    setInstanceOverride(ctx, inst1, 'text', 'Changed')
    expect(isOverridden(model.widget(inst1)!, 'text')).toBe(true)
    revertOverride(ctx, inst1, 'text')
    expect(isOverridden(model.widget(inst1)!, 'text')).toBe(false)
    expect(effectiveValue(model, model.widget(inst1)!, 'text')).toBe(masterValue(model, model.widget(inst1)!, 'text'))
    undo.undo() // undo revert → override back
    expect(effectiveValue(model, model.widget(inst1)!, 'text')).toBe('Changed')
  })

  it('reset-all clears every override in one undo entry, with a live count', () => {
    const { model, undo, inst1, ctx } = setup()
    setInstanceOverride(ctx, inst1, 'text', 'A')
    setInstanceOverride(ctx, inst1, 'color', '#f00')
    setInstanceOverride(ctx, inst1, 'padding', 8)
    expect(overrideCount(model.widget(inst1)!)).toBe(3)
    resetAllOverrides(ctx, inst1)
    expect(overrideCount(model.widget(inst1)!)).toBe(0)
    undo.undo()
    expect(overrideCount(model.widget(inst1)!)).toBe(3)
  })

  it('variant override participates in the resolution chain', () => {
    const { model, componentId, inst1, ctx } = setup()
    // add a variant with an override and apply it
    const variantId = model.newId('variant')
    model.addVariant(componentId, { id: variantId, name: 'Alt', overrides: { text: 'From variant' } })
    model.setVariant(inst1, variantId)
    // no instance override → variant wins over master
    expect(effectiveValue(model, model.widget(inst1)!, 'text')).toBe('From variant')
    // instance override wins over the variant
    setInstanceOverride(ctx, inst1, 'text', 'From instance')
    expect(effectiveValue(model, model.widget(inst1)!, 'text')).toBe('From instance')
  })

  it('the document stays valid after overrides', () => {
    const { model, inst1, ctx } = setup()
    setInstanceOverride(ctx, inst1, 'text', 'X')
    expect(model.validate()).toEqual([])
  })
})
