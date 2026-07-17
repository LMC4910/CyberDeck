// ProjectService (CD-304, open flow CD-406) — owns the open ProjectModel, drives
// autosave, and is the single door a project comes through.
//
// The service is the seam between the authoring model and persistence. It:
//   • subscribes to model changes → marks the project dirty,
//   • debounces a serialize()+save through an injected ProjectPersistence port
//     (the composition root wires this to the persisted `project` store now and to
//     the gateway-backed ProjectsRepository at the M5 engine swap),
//   • publishes a saved-state ('saved' | 'dirty' | 'saving' | 'error') that the
//     status bar's saved-state indicator subscribes to,
//   • loads a stored document through the injected ProjectCatalog, hydrates it into
//     a ProjectModel and announces it (CD-406: open → ProjectOpened → recents).
//
// It imports no repositories/stores (boundary-clean): persistence, the catalog and
// the recents list are injected, and ProjectOpened is handed to an injected
// `onOpened` rather than emitted here — the wiring bridges it onto the EventBus,
// exactly as WorkspaceService does for WorkspaceChanged.
import type { ProjectOpenedEvent } from '@/shared/contract'
import { ProjectModel, type ProjectDocument } from '@/shared/project'
import type { ProjectCatalog, ProjectRecord } from './project-catalog'
import type { ProjectRecents } from './project-recents'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/** Where a serialized project is written. Implemented by the composition root. */
export interface ProjectPersistence {
  save(doc: ProjectDocument): Promise<void>
}

export interface ProjectServiceOptions {
  persistence: ProjectPersistence
  /** Stored-project access for the open/create flow (CD-406). */
  catalog?: ProjectCatalog
  /** Recents list updated on every successful open (CD-406). */
  recents?: ProjectRecents
  /** Bridged onto the EventBus as `ProjectOpened` by the wiring. */
  onOpened?: (event: ProjectOpenedEvent) => void
  /** Debounce window for autosave (ms). Default 800. */
  debounceMs?: number
  /** ISO timestamp source for `savedAt` (injectable for tests). */
  now?: () => string
}

export type SaveStateListener = (state: SaveState) => void
export type ModelListener = (model: ProjectModel | null) => void

export class NoCatalogError extends Error {
  constructor() {
    super('ProjectService has no catalog — the open flow needs one wired in')
    this.name = 'NoCatalogError'
  }
}

export class ProjectService {
  private currentModel: ProjectModel | null = null
  private currentId: string | null = null
  private unsubscribeModel: (() => void) | null = null
  private state: SaveState = 'saved'
  private readonly listeners = new Set<SaveStateListener>()
  private readonly modelListeners = new Set<ModelListener>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving = false
  private resaveQueued = false

  private readonly persistence: ProjectPersistence
  private readonly catalogPort?: ProjectCatalog
  private readonly recents?: ProjectRecents
  private readonly onOpened?: (event: ProjectOpenedEvent) => void
  private readonly debounceMs: number
  private readonly now: () => string

  constructor(options: ProjectServiceOptions) {
    this.persistence = options.persistence
    this.catalogPort = options.catalog
    this.recents = options.recents
    this.onOpened = options.onOpened
    this.debounceMs = options.debounceMs ?? 800
    this.now = options.now ?? (() => new Date().toISOString())
  }

  get model(): ProjectModel | null {
    return this.currentModel
  }
  get saveState(): SaveState {
    return this.state
  }
  /** Storage key of the open project, or null when it was never stored. */
  get openId(): string | null {
    return this.currentId
  }
  /** True while the open project has edits not yet written. */
  get isDirty(): boolean {
    return this.state === 'dirty' || this.state === 'saving'
  }
  get catalog(): ProjectCatalog | null {
    return this.catalogPort ?? null
  }

  subscribe(listener: SaveStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Notified whenever the open model is swapped (open/close) — the shell re-renders
   *  its ProjectModelProvider off this. */
  subscribeModel(listener: ModelListener): () => void {
    this.modelListeners.add(listener)
    return () => {
      this.modelListeners.delete(listener)
    }
  }

  /** Adopt a model as the open project. Starts clean ('saved'); edits mark it dirty. */
  open(model: ProjectModel, id?: string): void {
    this.unsubscribeModel?.()
    this.cancelTimer()
    this.currentModel = model
    this.currentId = id ?? null
    this.setState('saved')
    this.unsubscribeModel = model.subscribe(() => this.markDirty())
    for (const l of this.modelListeners) l(model)
  }

  /**
   * Hydrate a stored document into the open project: restore → adopt → record a
   * recent → announce ProjectOpened. The caller routes to the Design workspace off
   * the event (the service is navigation-agnostic).
   * Throws if the document fails the model's referential invariants.
   */
  openDocument(record: ProjectRecord): ProjectModel {
    const model = ProjectModel.restore(record)
    this.open(model, record.id)
    this.announceOpened(record)
    return model
  }

  /**
   * Load a stored project by id and open it. Flushes the outgoing project's pending
   * save first, so switching projects never drops an edit.
   */
  async openById(id: string): Promise<ProjectModel> {
    const catalog = this.requireCatalog()
    await this.flush()
    const record = await catalog.open(id)
    return this.openDocument({ ...record, id })
  }

  /** Store a new project document, then open it (the wizard's commit — CD-406). */
  async createProject(doc: ProjectRecord): Promise<ProjectModel> {
    const catalog = this.requireCatalog()
    await this.flush()
    const created = await catalog.create(doc)
    return this.openDocument({ ...created, id: created.id ?? doc.id })
  }

  private announceOpened(record: ProjectRecord): void {
    const name = record.meta.name
    const ts = Date.parse(this.now())
    if (record.id) {
      this.recents?.record({ id: record.id, name, openedAt: this.now() })
    }
    this.onOpened?.({
      projectId: record.id ?? '',
      name,
      ...(Number.isNaN(ts) ? {} : { ts }),
    })
  }

  private requireCatalog(): ProjectCatalog {
    if (!this.catalogPort) throw new NoCatalogError()
    return this.catalogPort
  }

  /** Close the open project, flushing any pending save first. */
  async close(): Promise<void> {
    await this.flush()
    this.unsubscribeModel?.()
    this.unsubscribeModel = null
    this.currentModel = null
    this.currentId = null
    for (const l of this.modelListeners) l(null)
  }

  private markDirty(): void {
    if (!this.currentModel) return
    this.setState('dirty')
    // If a save is mid-flight, don't race a second timer against it — flag a resave
    // so the in-flight save's completion re-runs with the newest document.
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

  /** Force any pending debounced save to run now (e.g. on quit/beforeunload). */
  async flush(): Promise<void> {
    if (this.timer) {
      this.cancelTimer()
      await this.saveNow()
    } else if (this.saving) {
      // A save is mid-flight; wait for the queue to drain.
      await this.settle()
    }
  }

  /** Serialize + persist immediately. Coalesces concurrent calls. */
  async saveNow(): Promise<void> {
    if (!this.currentModel) return
    if (this.saving) {
      this.resaveQueued = true
      return
    }
    this.saving = true
    this.setState('saving')
    try {
      const doc = this.currentModel.serialize({ savedAt: this.now() })
      await this.persistence.save(doc)
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

  private async settle(): Promise<void> {
    // Spin until no save is in flight (bounded by the microtask queue in practice).
    while (this.saving) await Promise.resolve()
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
    for (const l of this.listeners) l(state)
  }

  dispose(): void {
    this.unsubscribeModel?.()
    this.cancelTimer()
    this.listeners.clear()
    this.modelListeners.clear()
  }
}
