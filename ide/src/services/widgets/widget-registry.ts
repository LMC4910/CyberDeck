// Widget registry (CD-419). The single source of truth for loaded widget manifests.
// Registration emits the `WidgetLoaded` catalog event through an injected `emit`
// port (assembly bridges it to the TypedEventBus — this layer stays bus-agnostic),
// and notifies subscribers so the CD-421 surfaces (Insert/Library/palette/canvas)
// can react without direct wiring.
import type { WidgetLoadedEvent } from '@/shared/contract'
import type { WidgetManifest } from './types'

export interface WidgetRegistryOptions {
  /** Bridged to the TypedEventBus `WidgetLoaded` emit at assembly. */
  emit?: (event: WidgetLoadedEvent) => void
  /** Injectable clock for the event timestamp (tests). */
  now?: () => number
}

export class WidgetRegistry {
  private readonly manifests = new Map<string, WidgetManifest>()
  private readonly listeners = new Set<() => void>()
  private readonly emit?: (event: WidgetLoadedEvent) => void
  private readonly now: () => number

  constructor(options: WidgetRegistryOptions = {}) {
    this.emit = options.emit
    this.now = options.now ?? (() => Date.now())
  }

  /**
   * Register a validated, dependency-satisfied manifest. Emits `WidgetLoaded` and
   * notifies subscribers. Re-registering the same id replaces it (a hot-reload
   * path) and re-emits. Returns the registered manifest.
   */
  register(manifest: WidgetManifest): WidgetManifest {
    this.manifests.set(manifest.id, manifest)
    this.emit?.({ widgetId: manifest.id, type: manifest.id, ts: this.now() })
    this.notify()
    return manifest
  }

  get(id: string): WidgetManifest | undefined {
    return this.manifests.get(id)
  }

  has(id: string): boolean {
    return this.manifests.has(id)
  }

  /** All registered manifests (stable insertion order). */
  list(): WidgetManifest[] {
    return [...this.manifests.values()]
  }

  ids(): string[] {
    return [...this.manifests.keys()]
  }

  get size(): number {
    return this.manifests.size
  }

  /** Subscribe to registry changes (CD-421 surfaces). Returns an unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Remove a manifest (dev/hot-reload). Notifies subscribers. */
  unregister(id: string): void {
    if (this.manifests.delete(id)) this.notify()
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
