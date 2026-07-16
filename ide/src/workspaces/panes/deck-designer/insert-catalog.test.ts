import { describe, it, expect } from 'vitest'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { INSERT_CATALOG, makeInsertNode, insertManifest } from './insert-catalog'

function setup() {
  const model = ProjectModel.empty('I')
  const pageId = model.pages()[0]!.id
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  return { model, pageId, engine, undo }
}

const gauge = INSERT_CATALOG.find((m) => m.type === 'gauge.circular')!

describe('insert catalog (CD-315)', () => {
  it('makeInsertNode builds a correctly-configured node at the top-left', () => {
    const { model } = setup()
    const node = makeInsertNode(model, gauge, { x: 40, y: 60 })
    expect(node.type).toBe('gauge.circular')
    expect(node.name).toBe('Circular Gauge')
    expect(node.frame).toEqual({ x: 40, y: 60, w: 200, h: 160 })
    expect(node.config).toMatchObject({ min: 0, max: 100 })
    expect(node.id.startsWith('w_')).toBe(true)
  })

  it('insertManifest centers on the point, selects the node, one undo entry', () => {
    const { model, pageId, engine, undo } = setup()
    const id = insertManifest({ model, undo, engine, pageId }, gauge, { x: 500, y: 400 })
    const node = model.widget(id)!
    expect(node.frame).toEqual({ x: 400, y: 320, w: 200, h: 160 }) // centered
    expect(engine.state.ids).toEqual([id])
    expect(undo.length).toBe(1)
    undo.undo()
    expect(model.widget(id)).toBeUndefined()
  })

  it('the catalog covers multiple categories', () => {
    const cats = new Set(INSERT_CATALOG.map((m) => m.category))
    expect(cats.size).toBeGreaterThanOrEqual(3)
  })
})
