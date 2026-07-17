import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import type { ProjectOpenedEvent } from '@/shared/contract'
import { NoCatalogError, ProjectService, type ProjectPersistence, type SaveState } from './project-service'
import type { ProjectCatalog, ProjectPage, ProjectRecord } from './project-catalog'
import { ProjectRecents } from './project-recents'

function w(id: string): WidgetInstance {
  return { id, type: 'core.gauge', frame: { x: 0, y: 0, w: 10, h: 10 } }
}

function doc(id: string, name: string): ProjectRecord {
  return {
    format: 'cyberdeck.project',
    version: 1,
    id,
    meta: { name },
    pages: [{ id: 'page_aaaaaa', name: 'Main', widgets: [] }],
  }
}

/** Minimal in-memory stand-in for the ProjectsRepository the root binds. */
function fakeCatalog(seed: ProjectRecord[] = []) {
  const docs = new Map(seed.map((d) => [d.id!, d]))
  const catalog: ProjectCatalog = {
    query: vi.fn(async (): Promise<ProjectPage> => ({ items: [...docs.values()], page: 1, limit: 50 })),
    open: vi.fn(async (id: string) => {
      const found = docs.get(id)
      if (!found) throw new Error(`not found: ${id}`)
      return structuredClone(found)
    }),
    create: vi.fn(async (body: unknown) => {
      const record = body as ProjectRecord
      docs.set(record.id!, record)
      return record
    }),
    update: vi.fn(async (id: string, body: unknown) => {
      const record = { ...(body as ProjectRecord), id }
      docs.set(id, record)
      return record
    }),
    remove: vi.fn(async (id: string) => void docs.delete(id)),
  }
  return { catalog, docs }
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

describe('ProjectService — open flow (CD-406)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function svcWith(seed: ProjectRecord[] = []) {
    const { catalog, docs } = fakeCatalog(seed)
    const { persistence } = fakePersistence()
    const opened: ProjectOpenedEvent[] = []
    const recents = new ProjectRecents({ storage: new MemoryStorageAdapter() })
    const svc = new ProjectService({
      persistence,
      catalog,
      recents,
      onOpened: (e) => opened.push(e),
      debounceMs: 100,
      now: () => '2026-07-17T10:00:00.000Z',
    })
    return { svc, catalog, docs, opened, recents, persistence }
  }

  it('openById loads the document, hydrates the model and announces ProjectOpened', async () => {
    const { svc, catalog, opened } = svcWith([doc('proj_aaaaaa', 'Battlestation')])
    const model = await svc.openById('proj_aaaaaa')

    expect(catalog.open).toHaveBeenCalledWith('proj_aaaaaa')
    expect(model.document.meta.name).toBe('Battlestation')
    expect(svc.model).toBe(model)
    expect(svc.openId).toBe('proj_aaaaaa')
    expect(opened).toEqual([
      { projectId: 'proj_aaaaaa', name: 'Battlestation', ts: Date.parse('2026-07-17T10:00:00.000Z') },
    ])
  })

  it('records a recent on every open, most-recent-first', async () => {
    const { svc, recents } = svcWith([doc('proj_aaaaaa', 'A'), doc('proj_bbbbbb', 'B')])
    await svc.openById('proj_aaaaaa')
    await svc.openById('proj_bbbbbb')
    expect(recents.list().map((r) => r.id)).toEqual(['proj_bbbbbb', 'proj_aaaaaa'])
    expect(recents.list()[0]).toMatchObject({ name: 'B', openedAt: '2026-07-17T10:00:00.000Z' })
  })

  it('flushes the outgoing project before switching, so no edit is dropped', async () => {
    const { svc, persistence } = svcWith([doc('proj_bbbbbb', 'B')])
    const a = ProjectModel.empty('A')
    svc.open(a, 'proj_aaaaaa')
    a.addWidget(a.pages()[0]!.id, w('w_aaaaaa')) // dirty, debounce still pending
    expect(svc.isDirty).toBe(true)

    await svc.openById('proj_bbbbbb')
    expect(persistence.save).toHaveBeenCalledTimes(1) // the pending edit landed
    expect(svc.openId).toBe('proj_bbbbbb')
  })

  it('createProject stores the document, then opens it', async () => {
    const { svc, catalog, docs, opened } = svcWith()
    const record = doc('proj_cccccc', 'Fresh')
    const model = await svc.createProject(record)

    expect(catalog.create).toHaveBeenCalledWith(record)
    expect(docs.get('proj_cccccc')?.meta.name).toBe('Fresh')
    expect(model.document.meta.name).toBe('Fresh')
    expect(svc.openId).toBe('proj_cccccc')
    expect(opened[0]?.projectId).toBe('proj_cccccc')
  })

  it('notifies model subscribers when the open model is swapped or closed', async () => {
    const { svc } = svcWith([doc('proj_aaaaaa', 'A')])
    const seen: (string | null)[] = []
    svc.subscribeModel((m) => seen.push(m?.document.meta.name ?? null))
    await svc.openById('proj_aaaaaa')
    await svc.close()
    expect(seen).toEqual(['A', null])
  })

  it('rejects a document that fails the model invariants, leaving the open project alone', async () => {
    const broken = doc('proj_dddddd', 'Broken')
    broken.pages[0].widgets = [w('w_dupdup'), w('w_dupdup')] // duplicate ids
    const { svc } = svcWith([broken])
    const before = ProjectModel.empty('Keep')
    svc.open(before, 'proj_keep01')

    await expect(svc.openById('proj_dddddd')).rejects.toThrow(/duplicate id/)
    expect(svc.model).toBe(before)
    expect(svc.openId).toBe('proj_keep01')
  })

  it('the open flow needs a catalog — without one it fails loudly', async () => {
    const { persistence } = fakePersistence()
    const svc = new ProjectService({ persistence })
    await expect(svc.openById('proj_aaaaaa')).rejects.toBeInstanceOf(NoCatalogError)
  })
})
