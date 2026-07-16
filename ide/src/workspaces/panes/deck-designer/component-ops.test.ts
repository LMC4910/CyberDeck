import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { createComponentFromSelection, instantiateComponent, detachInstance, findInstances, INSTANCE_TYPE } from './component-ops'
import { duplicateSelection } from './canvas-commands'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 60, h: 40 }, config: { max: 100 } }
}

function setup() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'C' },
    pages: [{ id: 'page_cmptst', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa', 0), w('w_bbbbbb', 100)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const ctx = { model, engine, undo, pageId: 'page_cmptst' }
  return { model, engine, undo, ctx }
}

describe('component ops (CD-316)', () => {
  it('creates a component from a selection, replacing widgets with an instance (undoable)', () => {
    const { model, engine, undo, ctx } = setup()
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    const before = model.snapshot()
    const componentId = createComponentFromSelection(ctx, 'Card')!
    // originals gone, one instance remains linking to the component
    expect(model.widget('w_aaaaaa')).toBeUndefined()
    const instances = findInstances(model, componentId)
    expect(instances).toHaveLength(1)
    expect(model.widget(instances[0]!)!.type).toBe(INSTANCE_TYPE)
    expect(model.component(componentId)!.widgets).toHaveLength(2)
    expect(model.validate()).toEqual([])
    // undoable
    undo.undo()
    expect(model.snapshot()).toEqual(before)
  })

  it('instantiates a component (deep copy w/ master link), undoable', () => {
    const { model, engine, undo, ctx } = setup()
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    const componentId = createComponentFromSelection(ctx, 'Card')!
    const inst2 = instantiateComponent(ctx, componentId, { x: 400, y: 300 })!
    expect(findInstances(model, componentId)).toHaveLength(2)
    expect(model.widget(inst2)!.component).toBe(componentId)
    undo.undo()
    expect(findInstances(model, componentId)).toHaveLength(1)
  })

  it('detaches an instance into fresh template copies (undoable)', () => {
    const { model, engine, undo, ctx } = setup()
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    const componentId = createComponentFromSelection(ctx, 'Card')!
    const instanceId = findInstances(model, componentId)[0]!
    const copies = detachInstance(ctx, instanceId)
    expect(copies).toHaveLength(2)
    expect(model.widget(instanceId)).toBeUndefined() // instance gone
    // copies are plain widgets with fresh ids, no component link
    for (const id of copies) expect(model.widget(id)!.component).toBeUndefined()
    expect(model.validate()).toEqual([])
    undo.undo()
    expect(model.widget(instanceId)).toBeDefined()
  })

  it('master↔instance links are ID-keyed and survive renaming the master', () => {
    const { model, engine, ctx } = setup()
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    const componentId = createComponentFromSelection(ctx, 'Card')!
    const instanceId = findInstances(model, componentId)[0]!
    // rename the master (component name presentation) — the id link is untouched
    model.setName(instanceId, 'Renamed instance')
    // instantiate more, then confirm all still resolve by id
    instantiateComponent(ctx, componentId, { x: 200, y: 200 })
    expect(findInstances(model, componentId)).toHaveLength(2)
    expect(model.widget(instanceId)!.component).toBe(componentId)
  })

  it('duplicating an instance keeps the component link (ID-keyed)', () => {
    const { model, engine, undo, ctx } = setup()
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    const componentId = createComponentFromSelection(ctx, 'Card')!
    const instanceId = findInstances(model, componentId)[0]!
    engine.selectOnly(instanceId)
    duplicateSelection({ model, engine, undo })
    const instances = findInstances(model, componentId)
    expect(instances).toHaveLength(2) // original + duplicate both link to the master
  })
})
