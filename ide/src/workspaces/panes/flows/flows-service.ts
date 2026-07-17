// FlowsService (CD-409) — owns the open FlowModel and drives its persistence, the
// same shape ProjectService (CD-304) uses for the authoring document:
//   • load() reads the collection through an injected FlowsPersistence port, seeds
//     the starter flows when it comes back empty, and adopts a FlowModel,
//   • model changes mark the collection dirty → a debounced diffed write-back
//     (create new flows / update changed ones / delete removed ones),
//   • a saved-state ('saved' | 'dirty' | 'saving' | 'error') the pane surfaces.
//
// The port is the FlowsRepository seam: its member shapes are the subset of the
// CD-124 `FlowsRepository` this workspace needs, so the composition root can pass a
// real `new FlowsRepository(gateway)` at the M5 swap with no change here. Until the
// gateway is wired into boot, `localFlowsPersistence` backs it with the same
// StorageAdapter the rest of the kernel persists through. The workspace itself
// imports no repositories (boundary-clean) — persistence is injected.
import type { StorageAdapter } from '@/services/persistence'
import { FlowModel, type FlowDocument } from './flow-model'
import { starterFlows } from './flow-starter'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
export type FlowsStatus = 'loading' | 'ready' | 'error'

/** The slice of the CD-124 FlowsRepository the Flows workspace uses. */
export interface FlowsPersistence {
  query(): Promise<{ items: FlowDocument[] }>
  create(body: FlowDocument): Promise<unknown>
  update(id: string, body: FlowDocument): Promise<unknown>
  remove(id: string): Promise<void>
  /**
   * Arm/disarm the flow's trigger at runtime (`flows.arm`). Optional: `armed` is
   * presentation-only in the document (FLOW_MAPPING.md §known deviations), so a port
   * with no TriggerManager behind it — like the local one — simply omits this and the
   * document's `armed` field still round-trips.
   */
  arm?(id: string, armed: boolean): Promise<void>
}

export interface FlowsServiceOptions {
  persistence: FlowsPersistence
  /** Debounce window for the write-back (ms). Default 800 — matches ProjectService. */
  debounceMs?: number
  /** Seed used when the collection is empty. Default: the starter flows. */
  seed?: () => FlowDocument[]
}

/** A flow's identity for change detection is everything but its version counter. */
function fingerprint(doc: FlowDocument): string {
  const { version: _version, ...rest } = doc
  return JSON.stringify(rest)
}

export class FlowsService {
  private currentModel: FlowModel | null = null
  private unsubscribeModel: (() => void) | null = null
  private currentStatus: FlowsStatus = 'loading'
  private state: SaveState = 'saved'
  private rev = 0
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving = false
  private resaveQueued = false
  /** flow id → fingerprint of the last successfully written document. */
  private readonly written = new Map<string, string>()
  /** flow id → version last written (the schema's monotonic document version). */
  private readonly versions = new Map<string, number>()

  private readonly persistence: FlowsPersistence
  private readonly debounceMs: number
  private readonly seed: () => FlowDocument[]

  constructor(options: FlowsServiceOptions) {
    this.persistence = options.persistence
    this.debounceMs = options.debounceMs ?? 800
    this.seed = options.seed ?? starterFlows
  }

  get model(): FlowModel | null {
    return this.currentModel
  }
  get status(): FlowsStatus {
    return this.currentStatus
  }
  get saveState(): SaveState {
    return this.state
  }
  /** Monotonic counter for useSyncExternalStore — bumps on any service-state change. */
  get stateRev(): number {
    return this.rev
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Read the collection and adopt a model. Safe to call repeatedly (the second call
   * is a no-op once loaded) — the pane calls it on mount. An empty collection seeds
   * the starter flows and writes them straight back so a first run persists.
   */
  async load(): Promise<void> {
    if (this.currentModel) return
    this.setStatus('loading')
    let docs: FlowDocument[]
    try {
      docs = (await this.persistence.query()).items
    } catch {
      this.setStatus('error')
      return
    }
    const seeded = docs.length === 0
    if (seeded) docs = this.seed()
    for (const doc of docs) {
      this.written.set(doc.id, fingerprint(doc))
      this.versions.set(doc.id, doc.version)
    }
    this.adopt(new FlowModel(docs))
    this.setStatus('ready')
    // A seeded collection has never been written — persist it now rather than waiting
    // for the author's first edit, so a first run survives a reload untouched.
    if (seeded) {
      this.written.clear()
      this.versions.clear()
      await this.saveNow()
    }
  }

  private adopt(model: FlowModel): void {
    this.unsubscribeModel?.()
    this.cancelTimer()
    this.currentModel = model
    this.setState('saved')
    this.unsubscribeModel = model.subscribe(() => this.markDirty())
    this.bump()
  }

  private markDirty(): void {
    if (!this.currentModel) return
    this.setState('dirty')
    // A save mid-flight must not race a second timer — flag a resave so the in-flight
    // save's completion re-runs with the newest documents.
    if (this.saving) {
      this.resaveQueued = true
      return
    }
    this.cancelTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.saveNow()
    }, this.debounceMs)
  }

  /** Force any pending debounced write to run now (quit/beforeunload path). */
  async flush(): Promise<void> {
    if (this.timer) {
      this.cancelTimer()
      await this.saveNow()
    } else if (this.saving) {
      while (this.saving) await Promise.resolve()
    }
  }

  /**
   * Write every changed flow through the port. Diffed: an untouched flow is not
   * re-sent, a changed one bumps its monotonic `version`, a flow that left the model
   * is deleted. Coalesces concurrent calls.
   */
  async saveNow(): Promise<void> {
    const model = this.currentModel
    if (!model) return
    if (this.saving) {
      this.resaveQueued = true
      return
    }
    this.saving = true
    this.setState('saving')
    try {
      const docs = model.serialize()
      for (const doc of docs) {
        const fp = fingerprint(doc)
        const previous = this.written.get(doc.id)
        if (previous === fp) continue
        const version = previous === undefined ? doc.version : (this.versions.get(doc.id) ?? doc.version) + 1
        const out: FlowDocument = { ...doc, version }
        if (previous === undefined) await this.persistence.create(out)
        else await this.persistence.update(doc.id, out)
        this.written.set(doc.id, fp)
        this.versions.set(doc.id, version)
      }
      const live = new Set(docs.map((d) => d.id))
      for (const id of [...this.written.keys()]) {
        if (live.has(id)) continue
        await this.persistence.remove(id)
        this.written.delete(id)
        this.versions.delete(id)
      }
      this.setState(this.resaveQueued ? 'dirty' : 'saved')
    } catch {
      this.setState('error')
    } finally {
      this.saving = false
      if (this.resaveQueued) {
        this.resaveQueued = false
        await this.saveNow()
      }
    }
  }

  /**
   * Arm/disarm at runtime. The document's `armed` field is written by the ordinary
   * save path; this additionally notifies the port's TriggerManager when it has one.
   * A failure downgrades the save state rather than throwing at the caller — the
   * toggle is optimistic and undoable.
   */
  async arm(id: string, armed: boolean): Promise<void> {
    try {
      await this.persistence.arm?.(id, armed)
    } catch {
      this.setState('error')
    }
  }

  dispose(): void {
    this.unsubscribeModel?.()
    this.unsubscribeModel = null
    this.cancelTimer()
    this.listeners.clear()
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private setState(state: SaveState): void {
    if (state === this.state) return
    this.state = state
    this.bump()
  }

  private setStatus(status: FlowsStatus): void {
    if (status === this.currentStatus) return
    this.currentStatus = status
    this.bump()
  }

  private bump(): void {
    this.rev++
    for (const l of this.listeners) l()
  }
}

/** Storage key holding the whole flow collection for the local port. */
export const FLOWS_STORAGE_KEY = 'cdk-flows'

/**
 * The port the workspace runs on until the gateway is wired into boot: the flow
 * collection as one JSON blob in the kernel's StorageAdapter. A corrupt blob reads as
 * an empty collection (the service then re-seeds) rather than crashing the pane.
 */
export function localFlowsPersistence(adapter: StorageAdapter): FlowsPersistence {
  const read = (): FlowDocument[] => {
    const raw = adapter.get(FLOWS_STORAGE_KEY)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as FlowDocument[]) : []
    } catch {
      return []
    }
  }
  const write = (docs: FlowDocument[]) => adapter.set(FLOWS_STORAGE_KEY, JSON.stringify(docs))

  return {
    query: async () => ({ items: read() }),
    create: async (body) => {
      write([...read(), body])
      return body
    },
    update: async (id, body) => {
      const docs = read()
      const i = docs.findIndex((d) => d.id === id)
      if (i >= 0) docs[i] = body
      else docs.push(body)
      write(docs)
      return body
    },
    remove: async (id) => write(read().filter((d) => d.id !== id)),
  }
}
