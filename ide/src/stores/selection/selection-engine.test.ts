import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, selectionMode, primaryWidgetId } from './selection-store'
import { SelectionEngine } from './selection-engine'

function w(id: string, frame: WidgetInstance['frame']): WidgetInstance {
  return { id, type: 'gauge.circular', frame }
}

function setup() {
  const model = ProjectModel.empty('S')
  const pageId = model.pages()[0]!.id
  model.addWidget(pageId, w('w_aaaaaa', { x: 0, y: 0, w: 50, h: 50 }))
  model.addWidget(pageId, w('w_bbbbbb', { x: 100, y: 0, w: 50, h: 50 }))
  model.addWidget(pageId, w('w_cccccc', { x: 200, y: 0, w: 50, h: 50 }))
  const store = createSelectionStore()
  const engine = new SelectionEngine(store)
  const ids = model.widgetsOf(pageId).map((x) => x.id)
  return { model, pageId, store, engine, ids }
}

describe('SelectionEngine (CD-305)', () => {
  it('plain click selects only that widget', () => {
    const { engine, store } = setup()
    engine.click('w_aaaaaa')
    expect(store.getState()).toMatchObject({ kind: 'widget', ids: ['w_aaaaaa'] })
    engine.click('w_bbbbbb')
    expect(store.getState().ids).toEqual(['w_bbbbbb'])
  })

  it('⌘/meta-click toggles membership', () => {
    const { engine, store } = setup()
    engine.click('w_aaaaaa')
    engine.click('w_bbbbbb', { meta: true })
    expect(store.getState().ids).toEqual(['w_aaaaaa', 'w_bbbbbb'])
    engine.click('w_aaaaaa', { meta: true })
    expect(store.getState().ids).toEqual(['w_bbbbbb'])
  })

  it('⇧-click extends a range along the ordered list', () => {
    const { engine, store, ids } = setup()
    engine.click('w_aaaaaa')
    engine.click('w_cccccc', { shift: true }, ids)
    expect(store.getState().ids).toEqual(['w_aaaaaa', 'w_bbbbbb', 'w_cccccc'])
  })

  it('marquee selects widgets intersecting the rect', () => {
    const { engine, store, model, pageId } = setup()
    engine.marqueeSelect({ x: -10, y: -10, w: 170, h: 70 }, model, pageId)
    expect(store.getState().ids.sort()).toEqual(['w_aaaaaa', 'w_bbbbbb'])
  })

  it('marquee additive keeps prior selection', () => {
    const { engine, store, model, pageId } = setup()
    engine.selectOnly('w_cccccc')
    engine.marqueeSelect({ x: -10, y: -10, w: 70, h: 70 }, model, pageId, true)
    expect(store.getState().ids.sort()).toEqual(['w_aaaaaa', 'w_cccccc'])
  })

  it('lasso selects widgets whose center is inside the polygon (⌥)', () => {
    const { engine, store, model, pageId } = setup()
    // Polygon around the first two widgets' centers (25,25) and (125,25).
    engine.lassoSelect(
      [
        { x: -10, y: -10 },
        { x: 160, y: -10 },
        { x: 160, y: 60 },
        { x: -10, y: 60 },
      ],
      model,
      pageId,
    )
    expect(store.getState().ids.sort()).toEqual(['w_aaaaaa', 'w_bbbbbb'])
  })

  it('Tab / ⇧Tab cycles through widgets with wraparound', () => {
    const { engine, store, model, pageId } = setup()
    engine.cycle(1, model, pageId)
    expect(store.getState().ids).toEqual(['w_aaaaaa'])
    engine.cycle(1, model, pageId)
    expect(store.getState().ids).toEqual(['w_bbbbbb'])
    engine.cycle(-1, model, pageId)
    expect(store.getState().ids).toEqual(['w_aaaaaa'])
    engine.cycle(-1, model, pageId) // wrap to last
    expect(store.getState().ids).toEqual(['w_cccccc'])
  })

  it('selectAll selects every widget on the page', () => {
    const { engine, store, model, pageId } = setup()
    engine.selectAll(model, pageId)
    expect(store.getState().ids).toHaveLength(3)
    expect(selectionMode(store.getState())).toBe('multi')
  })

  it('Esc / clear empties the selection', () => {
    const { engine, store } = setup()
    engine.selectOnly('w_aaaaaa')
    engine.clear()
    expect(store.getState()).toMatchObject({ kind: 'none', ids: [] })
    expect(selectionMode(store.getState())).toBe('none')
  })

  it('selection history [ / ] walks back and forward', () => {
    const { engine, store } = setup()
    engine.selectOnly('w_aaaaaa')
    engine.selectOnly('w_bbbbbb')
    engine.selectOnly('w_cccccc')
    expect(store.getState().ids).toEqual(['w_cccccc'])
    engine.back()
    expect(store.getState().ids).toEqual(['w_bbbbbb'])
    engine.back()
    expect(store.getState().ids).toEqual(['w_aaaaaa'])
    engine.forward()
    expect(store.getState().ids).toEqual(['w_bbbbbb'])
  })

  it('a new selection after going back truncates the redo tail', () => {
    const { engine, store } = setup()
    engine.selectOnly('w_aaaaaa')
    engine.selectOnly('w_bbbbbb')
    engine.back() // back to aaaaaa
    engine.selectOnly('w_cccccc') // new branch
    expect(engine.canGoForward).toBe(false)
    expect(store.getState().ids).toEqual(['w_cccccc'])
  })

  it('page selection reports page mode; primaryWidgetId only for single widget', () => {
    const { engine, store, pageId } = setup()
    engine.selectPage(pageId)
    expect(selectionMode(store.getState())).toBe('page')
    engine.selectOnly('w_aaaaaa')
    expect(primaryWidgetId(store.getState())).toBe('w_aaaaaa')
    engine.selectMany(['w_aaaaaa', 'w_bbbbbb'])
    expect(primaryWidgetId(store.getState())).toBeUndefined()
  })

  it('notifies subscribers on every committed change (single store, no fan-out)', () => {
    const { engine, store } = setup()
    let count = 0
    const unsub = store.subscribe(() => count++)
    engine.selectOnly('w_aaaaaa')
    engine.selectOnly('w_aaaaaa') // idempotent — no notify
    engine.selectOnly('w_bbbbbb')
    unsub()
    expect(count).toBe(2)
  })
})
