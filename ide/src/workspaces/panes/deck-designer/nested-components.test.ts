import { describe, it, expect } from 'vitest'
import { ProjectModel, isStableId, type WidgetInstance, type ProjectDocument } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import {
  createComponentFromSelection,
  instantiateComponent,
  deepDetachInstance,
  expandComponentDeep,
  componentRefs,
  nestingPath,
  findInstances,
  CircularComponentError,
  INSTANCE_TYPE,
} from './component-ops'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 40, h: 30 } }
}

/** Build: inner component (2 widgets) → instantiate it → make an OUTER component that
 *  contains the inner instance + a plain widget. Returns ids. */
function nested() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'N' },
    pages: [{ id: 'page_nsttst', name: 'P', canvas: { w: 900, h: 700 }, widgets: [w('w_inner1', 0), w('w_inner2', 60)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const ctx = { model, engine, undo, pageId: 'page_nsttst' }
  engine.selectMany(['w_inner1', 'w_inner2'])
  const innerId = createComponentFromSelection(ctx, 'Inner')!
  // add a plain widget next to the inner instance, then group both into OUTER
  model.addWidget('page_nsttst', w('w_extra1', 200))
  const innerInstance = findInstances(model, innerId)[0]!
  engine.selectMany([innerInstance, 'w_extra1'])
  const outerId = createComponentFromSelection(ctx, 'Outer')!
  return { model, engine, undo, ctx, innerId, outerId }
}

describe('nested components (CD-319)', () => {
  it('the outer component transitively references the inner component', () => {
    const { model, innerId, outerId } = nested()
    expect(componentRefs(model, outerId).has(innerId)).toBe(true)
    expect(nestingPath(model, outerId)).toContain('Inner')
  })

  it('deep-instantiate → fresh, unique, schema-valid ids at every level (fuzz)', () => {
    const { model, outerId } = nested()
    for (const seed of [1, 2, 3, 7, 42]) {
      const widgets = expandComponentDeep(model, outerId, { x: seed * 3, y: seed })
      const ids = widgets.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length) // all unique
      for (const id of ids) expect(isStableId(id)).toBe(true) // all schema-valid
      // fully expanded → no component refs remain (plain widgets only)
      expect(widgets.every((x) => !x.component)).toBe(true)
    }
  })

  it('deep-detach replaces the outer instance with fresh plain widgets (undoable)', () => {
    const { model, engine, undo, ctx, outerId } = nested()
    const instId = instantiateComponent(ctx, outerId, { x: 400, y: 300 })!
    const before = model.snapshot()
    const ids = deepDetachInstance(ctx, instId)
    expect(ids.length).toBeGreaterThanOrEqual(3) // inner(2) + extra(1)
    expect(model.widget(instId)).toBeUndefined()
    expect(ids.every((id) => !model.widget(id)!.component)).toBe(true)
    expect(model.validate()).toEqual([])
    void engine
    undo.undo()
    expect(model.snapshot()).toEqual(before)
  })

  it('a circular component nesting is rejected with a message', () => {
    // Hand-craft a cyclic document: A instantiates B, B instantiates A.
    const doc: ProjectDocument = {
      format: 'cyberdeck.project',
      version: 1,
      meta: { name: 'cyc' },
      pages: [{ id: 'page_cyctst', name: 'P', widgets: [] }],
      components: [
        { id: 'cmp_aaaaaa', name: 'A', widgets: [{ id: 'w_inaaaa', type: INSTANCE_TYPE, component: 'cmp_bbbbbb', frame: { x: 0, y: 0, w: 10, h: 10 } }] },
        { id: 'cmp_bbbbbb', name: 'B', widgets: [{ id: 'w_inbbbb', type: INSTANCE_TYPE, component: 'cmp_aaaaaa', frame: { x: 0, y: 0, w: 10, h: 10 } }] },
      ],
    }
    const model = new ProjectModel(doc)
    expect(model.validate().some((d) => d.code === 'circular-nesting')).toBe(true)
    expect(() => expandComponentDeep(model, 'cmp_aaaaaa', { x: 0, y: 0 })).toThrow(CircularComponentError)
    expect(() => componentRefs(model, 'cmp_aaaaaa')).toThrow(/circular/)
  })
})
