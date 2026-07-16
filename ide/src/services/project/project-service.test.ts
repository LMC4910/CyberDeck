import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { ProjectService, type ProjectPersistence, type SaveState } from './project-service'

function w(id: string): WidgetInstance {
  return { id, type: 'core.gauge', frame: { x: 0, y: 0, w: 10, h: 10 } }
}

function fakePersistence() {
  const saved: unknown[] = []
  let resolveNext: (() => void) | null = null
  const persistence: ProjectPersistence = {
    save: vi.fn(async (doc) => {
      saved.push(doc)
      if (resolveNext) {
        const r = resolveNext
        resolveNext = null
        r()
      }
    }),
  }
  return { persistence, saved }
}

describe('ProjectService (CD-304)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts saved and goes dirty on the first edit', () => {
    const { persistence } = fakePersistence()
    const svc = new ProjectService({ persistence, debounceMs: 500 })
    const model = ProjectModel.empty('X')
    svc.open(model)
    expect(svc.saveState).toBe('saved')
    model.addWidget(model.pages()[0]!.id, w('w_aaaaaa'))
    expect(svc.saveState).toBe('dirty')
  })

  it('debounces autosave and transitions dirty → saving → saved', async () => {
    const { persistence, saved } = fakePersistence()
    const states: SaveState[] = []
    const svc = new ProjectService({ persistence, debounceMs: 500, now: () => '2026-07-16T00:00:00Z' })
    svc.subscribe((s) => states.push(s))
    const model = ProjectModel.empty('X')
    svc.open(model)
    const pageId = model.pages()[0]!.id

    model.addWidget(pageId, w('w_aaaaaa'))
    model.addWidget(pageId, w('w_bbbbbb')) // second edit resets the debounce
    expect(persistence.save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)
    expect(persistence.save).toHaveBeenCalledTimes(1) // coalesced to one save
    expect(svc.saveState).toBe('saved')
    expect(states).toEqual(['dirty', 'saving', 'saved'])
    // savedAt stamped by the injected clock.
    expect((saved[0] as { savedAt: string }).savedAt).toBe('2026-07-16T00:00:00Z')
    // both edits present in the saved doc
    expect((saved[0] as { pages: { widgets: unknown[] }[] }).pages[0]!.widgets).toHaveLength(2)
  })

  it('flush() saves pending edits immediately (quit/beforeunload path)', async () => {
    const { persistence } = fakePersistence()
    const svc = new ProjectService({ persistence, debounceMs: 10_000 })
    const model = ProjectModel.empty('X')
    svc.open(model)
    model.addWidget(model.pages()[0]!.id, w('w_aaaaaa'))
    await svc.flush()
    expect(persistence.save).toHaveBeenCalledTimes(1)
    expect(svc.saveState).toBe('saved')
  })

  it('reports error state when persistence rejects', async () => {
    const persistence: ProjectPersistence = { save: vi.fn(async () => { throw new Error('disk full') }) }
    const svc = new ProjectService({ persistence, debounceMs: 100 })
    const model = ProjectModel.empty('X')
    svc.open(model)
    model.addWidget(model.pages()[0]!.id, w('w_aaaaaa'))
    await vi.advanceTimersByTimeAsync(100)
    expect(svc.saveState).toBe('error')
  })

  it('edits during an in-flight save queue a follow-up save', async () => {
    // A gated persistence: the first save stays pending until released, opening a
    // real in-flight window for the queued-edit path.
    const gates: Array<() => void> = []
    const save = vi.fn(
      () =>
        new Promise<void>((r) => {
          gates.push(r)
        }),
    )
    const svc = new ProjectService({ persistence: { save }, debounceMs: 100 })
    const model = ProjectModel.empty('X')
    const pageId = model.pages()[0]!.id
    svc.open(model)

    model.addWidget(pageId, w('w_aaaaaa'))
    await vi.advanceTimersByTimeAsync(100) // saveNow starts, save() pending
    expect(save).toHaveBeenCalledTimes(1)
    expect(svc.saveState).toBe('saving')

    model.addWidget(pageId, w('w_bbbbbb')) // edit while saving → queued
    gates[0]!() // release first save → finally re-saves the queued edit
    await Promise.resolve()
    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(2)
    gates[1]!() // release the follow-up save
    await Promise.resolve()
    expect(svc.saveState).toBe('saved')
  })

  it('open() swaps projects and stops autosaving the old one', async () => {
    const { persistence } = fakePersistence()
    const svc = new ProjectService({ persistence, debounceMs: 100 })
    const a = ProjectModel.empty('A')
    const b = ProjectModel.empty('B')
    svc.open(a)
    svc.open(b)
    a.addWidget(a.pages()[0]!.id, w('w_aaaaaa')) // edit to the closed model
    await vi.advanceTimersByTimeAsync(200)
    expect(persistence.save).not.toHaveBeenCalled()
    expect(svc.saveState).toBe('saved')
  })
})
