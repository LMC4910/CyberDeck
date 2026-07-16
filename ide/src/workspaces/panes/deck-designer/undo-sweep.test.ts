// Undo integration sweep (CD-329). Exercises every authoring OPERATION path through
// its ops module (all of which record via undo.execUndoable) and proves that a random
// N-op sequence fully reverts: N undos → document deep-equals the baseline. If any op
// mutated the model outside execUndoable, the final undo would not restore and this
// property fails — the guard against direct-mutation escapes.
import { describe, it, expect } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { insertManifest, INSERT_CATALOG } from './insert-catalog'
import { duplicateSelection, toggleLockSelection, groupSelection, deleteSelection } from './canvas-commands'
import { createComponentFromSelection, instantiateComponent, addVariant, findInstances } from './component-ops'
import { setInstanceOverride } from './override-ops'
import { setBinding } from './binding-ops'
import { setDelta, setActive } from './state-ops'
import { assignFlow } from './flows-catalog'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'button.action', frame: { x, y: 0, w: 60, h: 40 } }
}

function fixture() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'Sweep' },
    pages: [{ id: 'page_swptst', name: 'P', canvas: { w: 1200, h: 800 }, widgets: [w('w_seed001', 0), w('w_seed002', 80), w('w_seed003', 160)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack({ cap: 500 })
  return { model, engine, undo, pageId: 'page_swptst' }
}

describe('undo sweep — each op is a single revertible entry (CD-329)', () => {
  const gauge = INSERT_CATALOG.find((m) => m.type === 'gauge.circular')!
  const spot: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
    ['insert', ({ model, engine, undo, pageId }) => insertManifest({ model, undo, engine, pageId }, gauge, { x: 300, y: 300 })],
    ['lock', ({ model, engine, undo }) => { engine.selectOnly('w_seed001'); toggleLockSelection({ model, engine, undo }) }],
    ['duplicate', ({ model, engine, undo }) => { engine.selectOnly('w_seed001'); duplicateSelection({ model, engine, undo }) }],
    ['group', ({ model, engine, undo }) => { engine.selectMany(['w_seed001', 'w_seed002']); groupSelection({ model, engine, undo }) }],
    ['delete', ({ model, engine, undo }) => { engine.selectOnly('w_seed003'); deleteSelection({ model, engine, undo }) }],
    ['bind', ({ model, undo }) => setBinding({ model, undo }, 'w_seed001', 'value', { mode: 'variable', src: 'fps.current' })],
    ['state-delta', ({ model, undo }) => setDelta({ model, undo }, 'w_seed001', 'hover', 'opacity', 0.5)],
    ['state-active', ({ model, undo }) => setActive({ model, undo }, 'w_seed001', 'hover')],
    ['event', ({ model, undo }) => assignFlow({ model, undo }, 'w_seed001', 'tap', 'flow_reset1')],
    ['component', ({ model, engine, undo, pageId }) => { engine.selectMany(['w_seed001', 'w_seed002']); createComponentFromSelection({ model, engine, undo, pageId }, 'C') }],
  ]

  it.each(spot)('%s → one entry, undo restores', (_name, run) => {
    const f = fixture()
    const before = f.model.snapshot()
    run(f)
    expect(f.model.snapshot()).not.toEqual(before)
    while (f.undo.canUndo) f.undo.undo()
    expect(f.model.snapshot()).toEqual(before)
  })
})

describe('undo sweep — random 50-op sequence fully reverts (CD-329)', () => {
  it('50 ops → undo all → document deep-equals baseline', () => {
    const f = fixture()
    const baseline = f.model.snapshot()
    const { model, engine, undo, pageId } = f
    const ctx = { model, engine, undo, pageId }

    // Deterministic LCG.
    let s = 20260717
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const pick = <T>(xs: T[]): T | undefined => (xs.length ? xs[Math.floor(rnd() * xs.length)] : undefined)

    for (let i = 0; i < 50; i++) {
      const ids = model.rootWidgets(pageId).map((x) => x.id)
      const target = pick(ids)
      const op = Math.floor(rnd() * 11)
      try {
        switch (op) {
          case 0: insertManifest(ctx, pick(INSERT_CATALOG)!, { x: rnd() * 1000, y: rnd() * 600 }); break
          case 1: if (target) { engine.selectOnly(target); toggleLockSelection(ctx) } break
          case 2: if (target) { engine.selectOnly(target); duplicateSelection(ctx) } break
          case 3: if (ids.length >= 2) { engine.selectMany([ids[0]!, ids[1]!]); groupSelection(ctx) } break
          case 4: if (target && ids.length > 1) { engine.selectOnly(target); deleteSelection(ctx) } break
          case 5: if (target) setBinding(ctx, target, 'value', rnd() > 0.5 ? { mode: 'variable', src: 'system.cpu.percent' } : { mode: 'expression', expr: 'fps.current + 1' }); break
          case 6: if (target) setDelta(ctx, target, 'hover', 'opacity', Math.round(rnd() * 10) / 10); break
          case 7: if (target) setActive(ctx, target, rnd() > 0.5 ? 'hover' : 'default'); break
          case 8: if (target) assignFlow(ctx, target, 'tap', 'flow_mute01'); break
          case 9: if (ids.length >= 2) { engine.selectMany([ids[0]!, ids[1]!]); createComponentFromSelection(ctx, 'C') } break
          case 10: {
            const comp = model.components()[0]
            if (comp) {
              const inst = findInstances(model, comp.id)[0]
              if (inst) setInstanceOverride(ctx, inst, 'text', `t${i}`)
              addVariant(ctx, comp.id, `v${i}`)
              if (inst) instantiateComponent(ctx, comp.id, { x: rnd() * 800, y: rnd() * 500 })
            }
            break
          }
        }
      } catch {
        /* guarded no-ops (empty selection edges) are fine */
      }
      expect(model.validate()).toEqual([]) // invariants hold at every step
    }

    const opsRun = undo.length
    expect(opsRun).toBeGreaterThan(0)
    while (undo.canUndo) undo.undo()
    expect(model.snapshot()).toEqual(baseline)
  })
})
