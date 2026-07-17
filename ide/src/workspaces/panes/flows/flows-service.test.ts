import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryStorageAdapter } from '@/services/persistence'
import {
  FLOWS_STORAGE_KEY,
  FlowsService,
  localFlowsPersistence,
  type FlowsPersistence,
} from './flows-service'
import { blankFlow, readUiPos, type FlowDocument } from './flow-model'
import { starterFlows } from './flow-starter'

function spyPort(base: FlowsPersistence) {
  return {
    query: vi.fn(base.query),
    create: vi.fn(base.create),
    update: vi.fn(base.update),
    remove: vi.fn(base.remove),
    arm: vi.fn(async () => {}),
  }
}

describe('FlowsService load (CD-409)', () => {
  it('seeds the starter flows into an empty collection and writes them straight back', async () => {
    const adapter = new MemoryStorageAdapter()
    const port = spyPort(localFlowsPersistence(adapter))
    const svc = new FlowsService({ persistence: port })
    await svc.load()

    expect(svc.status).toBe('ready')
    expect(svc.model!.list().map((f) => f.id)).toEqual(['flow_strt0001', 'flow_lite0001'])
    // a first run must survive a reload untouched, not wait for the first edit
    expect(port.create).toHaveBeenCalledTimes(2)
    expect(JSON.parse(adapter.get(FLOWS_STORAGE_KEY)!)).toHaveLength(2)
    expect(svc.saveState).toBe('saved')
  })

  it('adopts an existing collection without re-seeding or re-writing it', async () => {
    const stored: FlowDocument[] = [{ ...blankFlow('flow_only0001', 'Only'), version: 7 }]
    const adapter = new MemoryStorageAdapter({ [FLOWS_STORAGE_KEY]: JSON.stringify(stored) })
    const port = spyPort(localFlowsPersistence(adapter))
    const svc = new FlowsService({ persistence: port })
    await svc.load()

    expect(svc.model!.list().map((f) => f.label)).toEqual(['Only'])
    expect(port.create).not.toHaveBeenCalled()
    expect(port.update).not.toHaveBeenCalled()
  })

  it('load() is idempotent — a second call keeps the adopted model', async () => {
    const svc = new FlowsService({ persistence: localFlowsPersistence(new MemoryStorageAdapter()) })
    await svc.load()
    const model = svc.model
    await svc.load()
    expect(svc.model).toBe(model)
  })

  it('a corrupt blob reads as empty and re-seeds instead of crashing', async () => {
    const adapter = new MemoryStorageAdapter({ [FLOWS_STORAGE_KEY]: '{ not json' })
    const svc = new FlowsService({ persistence: localFlowsPersistence(adapter) })
    await svc.load()
    expect(svc.status).toBe('ready')
    expect(svc.model!.list()).toHaveLength(2)
  })

  it('a failing port leaves the service in error with no model', async () => {
    const svc = new FlowsService({
      persistence: {
        query: async () => {
          throw new Error('gateway down')
        },
        create: async () => ({}),
        update: async () => ({}),
        remove: async () => {},
      },
    })
    await svc.load()
    expect(svc.status).toBe('error')
    expect(svc.model).toBeNull()
  })
})

describe('FlowsService write-back (CD-409)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function ready(seed?: () => FlowDocument[]) {
    const adapter = new MemoryStorageAdapter()
    const port = spyPort(localFlowsPersistence(adapter))
    const svc = new FlowsService({ persistence: port, debounceMs: 500, ...(seed ? { seed } : {}) })
    await svc.load()
    port.create.mockClear()
    port.update.mockClear()
    port.remove.mockClear()
    return { svc, port, adapter }
  }

  it('debounces edits into one write and transitions dirty → saving → saved', async () => {
    const { svc, port } = await ready()
    svc.model!.renameFlow('flow_lite0001', 'A')
    expect(svc.saveState).toBe('dirty')
    svc.model!.renameFlow('flow_lite0001', 'B')
    expect(port.update).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)
    expect(port.update).toHaveBeenCalledTimes(1)
    expect(svc.saveState).toBe('saved')
  })

  it('writes only the flows that changed, bumping their monotonic version', async () => {
    const { svc, port } = await ready()
    svc.model!.setArmed('flow_lite0001', true)
    await svc.flush()

    expect(port.update).toHaveBeenCalledTimes(1)
    const [id, body] = port.update.mock.calls[0]!
    expect(id).toBe('flow_lite0001')
    expect(body).toMatchObject({ armed: true, version: 2 })

    // an unchanged flow is never re-sent
    svc.model!.setArmed('flow_lite0001', false)
    await svc.flush()
    expect(port.update).toHaveBeenCalledTimes(2)
    expect(port.update.mock.calls[1]![1]).toMatchObject({ version: 3 })
    expect(port.update.mock.calls.map((c) => c[0])).toEqual(['flow_lite0001', 'flow_lite0001'])
  })

  it('creates a new flow and deletes one that left the model', async () => {
    const { svc, port, adapter } = await ready()
    const model = svc.model!
    const doc = blankFlow(model.newFlowId(), 'Fresh')
    model.addFlow(doc)
    model.removeFlow('flow_strt0001')
    await svc.flush()

    expect(port.create).toHaveBeenCalledTimes(1)
    expect(port.create.mock.calls[0]![0]).toMatchObject({ id: doc.id, label: 'Fresh' })
    expect(port.remove).toHaveBeenCalledWith('flow_strt0001')
    expect((JSON.parse(adapter.get(FLOWS_STORAGE_KEY)!) as FlowDocument[]).map((d) => d.id)).toEqual([
      'flow_lite0001',
      doc.id,
    ])
  })

  it('flush() writes pending edits immediately (quit path)', async () => {
    const { svc, port } = await ready()
    svc.model!.renameFlow('flow_lite0001', 'Quit')
    await svc.flush()
    expect(port.update).toHaveBeenCalledTimes(1)
    expect(svc.saveState).toBe('saved')
  })

  it('reports error state when the port rejects', async () => {
    const svc = new FlowsService({
      persistence: {
        query: async () => ({ items: [blankFlow('flow_one00001', 'One')] }),
        create: async () => ({}),
        update: async () => {
          throw new Error('disk full')
        },
        remove: async () => {},
      },
      debounceMs: 100,
    })
    await svc.load()
    svc.model!.renameFlow('flow_one00001', 'Two')
    await vi.advanceTimersByTimeAsync(100)
    expect(svc.saveState).toBe('error')
  })

  it('an edit during an in-flight save queues a follow-up write', async () => {
    const gates: Array<() => void> = []
    const update = vi.fn(
      (_id: string, _body: FlowDocument) =>
        new Promise<FlowDocument>((r) => {
          gates.push(() => r(blankFlow('flow_one00001', 'x')))
        }),
    )
    const svc = new FlowsService({
      persistence: {
        query: async () => ({ items: [blankFlow('flow_one00001', 'One')] }),
        create: async () => ({}),
        update,
        remove: async () => {},
      },
      debounceMs: 100,
    })
    await svc.load()

    svc.model!.renameFlow('flow_one00001', 'A')
    await vi.advanceTimersByTimeAsync(100)
    expect(update).toHaveBeenCalledTimes(1)
    expect(svc.saveState).toBe('saving')

    svc.model!.renameFlow('flow_one00001', 'B') // edit while saving → queued
    gates[0]!()
    await vi.advanceTimersByTimeAsync(0)
    expect(update).toHaveBeenCalledTimes(2)
    gates[1]!()
    await vi.advanceTimersByTimeAsync(0)
    expect(svc.saveState).toBe('saved')
    expect(update.mock.calls[1]![1]).toMatchObject({ label: 'B' })
  })

  it('arm() drives the port route when it has one, and survives one that has not', async () => {
    const { svc, port } = await ready()
    await svc.arm('flow_lite0001', true)
    expect(port.arm).toHaveBeenCalledWith('flow_lite0001', true)

    const bare = new FlowsService({ persistence: localFlowsPersistence(new MemoryStorageAdapter()) })
    await bare.load()
    await expect(bare.arm('flow_lite0001', true)).resolves.toBeUndefined()
    expect(bare.saveState).toBe('saved')
  })

  it('a failing arm route downgrades the save state instead of throwing at the caller', async () => {
    const svc = new FlowsService({
      persistence: {
        query: async () => ({ items: [blankFlow('flow_one00001', 'One')] }),
        create: async () => ({}),
        update: async () => ({}),
        remove: async () => {},
        arm: async () => {
          throw new Error('engine offline')
        },
      },
    })
    await svc.load()
    await svc.arm('flow_one00001', true)
    expect(svc.saveState).toBe('error')
  })
})

describe('flows persist + restore across sessions (CD-409 AC)', () => {
  it('a second service on the same storage restores labels, armed state and layout', async () => {
    vi.useFakeTimers()
    try {
      const adapter = new MemoryStorageAdapter()
      const first = new FlowsService({ persistence: localFlowsPersistence(adapter), debounceMs: 10 })
      await first.load()
      const model = first.model!
      model.renameFlow('flow_lite0001', 'Lights Out')
      model.setArmed('flow_lite0001', true)
      model.setArmed('flow_strt0001', false)
      model.moveNode('flow_lite0001', 'n_cmd0001', { x: 321, y: 654 })
      const created = blankFlow(model.newFlowId(), 'Session Two')
      model.addFlow(created)
      await first.flush()

      // A fresh service reading the same storage = the next IDE session.
      const second = new FlowsService({ persistence: localFlowsPersistence(adapter) })
      await second.load()
      const restored = second.model!

      expect(restored.list().map((f) => f.label)).toEqual(['Stream Start', 'Lights Out', 'Session Two'])
      expect(restored.armed('flow_lite0001')).toBe(true)
      expect(restored.armed('flow_strt0001')).toBe(false)
      expect(readUiPos(restored.node('flow_lite0001', 'n_cmd0001')!.params as Record<string, unknown>)).toEqual({
        x: 321,
        y: 654,
      })
      expect(restored.flow(created.id)!.label).toBe('Session Two')
      // restoring is not an edit — nothing is written back
      expect(second.saveState).toBe('saved')
    } finally {
      vi.useRealTimers()
    }
  })

  it('the restored model never re-mints an id it just loaded', async () => {
    const adapter = new MemoryStorageAdapter()
    const first = new FlowsService({ persistence: localFlowsPersistence(adapter) })
    await first.load()
    const created = blankFlow(first.model!.newFlowId(), 'Kept')
    first.model!.addFlow(created)
    await first.flush()

    const second = new FlowsService({ persistence: localFlowsPersistence(adapter) })
    await second.load()
    const minted = Array.from({ length: 20 }, () => second.model!.newFlowId())
    expect(minted).not.toContain(created.id)
  })
})

describe('starterFlows (CD-409)', () => {
  it('every seeded flow is shaped like the CD-112 contract', () => {
    for (const doc of starterFlows()) {
      expect(doc.id).toMatch(/^[a-z][a-z0-9]*_[a-z0-9][a-z0-9-]{5,}$/)
      expect(doc.label.length).toBeGreaterThan(0)
      expect(doc.version).toBeGreaterThanOrEqual(1)
      for (const node of doc.nodes) expect(node.id).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
      // no edge may reference a node the document does not carry
      const ids = new Set(doc.nodes.map((n) => n.id))
      for (const edge of doc.edges) {
        expect(ids.has(edge.from)).toBe(true)
        expect(ids.has(edge.to)).toBe(true)
      }
    }
  })
})
