// ProjectService (CD-304) — owns the open ProjectModel and drives autosave.
//
// The service is the seam between the authoring model and persistence. It:
//   • subscribes to model changes → marks the project dirty,
//   • debounces a serialize()+save through an injected ProjectPersistence port
//     (the composition root wires this to the persisted `project` store now and to
//     the gateway-backed ProjectsRepository at the M5 engine swap),
//   • publishes a saved-state ('saved' | 'dirty' | 'saving' | 'error') that the
//     status bar's saved-state indicator subscribes to.
//
// It imports no repositories/stores (boundary-clean); persistence is injected.
import type { ProjectDocument, ProjectModel } from '@/shared/project'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/** Where a serialized project is written. Implemented by the composition root. */
export interface ProjectPersistence {
  save(doc: ProjectDocument): Promise<void>
}

export interface ProjectServiceOptions {
  persistence: ProjectPersistence
  /** Debounce window for autosave (ms). Default 800. */
  debounceMs?: number
  /** ISO timestamp source for `savedAt` (injectable for tests). */
  now?: () => string
}

export type SaveStateListener = (state: SaveState) => void

export class ProjectService {
  private currentModel: ProjectModel | null = null
  private unsubscribeModel: (() => void) | null = null
  private state: SaveState = 'saved'
  private readonly listeners = new Set<SaveStateListener>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private saving = false
  private resaveQueued = false

  private readonly persistence: ProjectPersistence
  private readonly debounceMs: number
  private readonly now: () => string

  constructor(options: ProjectServiceOptions) {
    this.persistence = options.persistence
    this.debounceMs = options.debounceMs ?? 800
    this.now = options.now ?? (() => new Date().toISOString())
  }

  get model(): ProjectModel | null {
    return this.currentModel
  }
  get saveState(): SaveState {
    return this.state
  }

  subscribe(listener: SaveStateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Adopt a model as the open project. Starts clean ('saved'); edits mark it dirty. */
  open(model: ProjectModel): void {
    this.unsubscribeModel?.()
    this.cancelTimer()
    this.currentModel = model
    this.setState('saved')
    this.unsubscribeModel = model.subscribe(() => this.markDirty())
  }

  /** Close the open project, flushing any pending save first. */
  async close(): Promise<void> {
    await this.flush()
    this.unsubscribeModel?.()
    this.unsubscribeModel = null
    this.currentModel = null
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
  }
}
