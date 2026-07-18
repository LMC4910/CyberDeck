// Widget permissions store (CD-422). Persisted grant/deny decisions keyed by
// (widgetId, capability). Persistence is through the CD-118 StorageAdapter port
// (localStorage today, Tauri fs later) so a grant survives reload. The engine will
// enforce these later; today they gate the IDE-side capability broker. Reactive:
// UI subscribes via subscribe()/useSyncExternalStore. Corrupt storage degrades to
// an empty policy (never a crash).
import type { StorageAdapter } from '@/services/persistence'
import type { WidgetCapability } from './types'
import type { PermissionDecision, PermissionState } from './permissions'

/** Persisted shape: widgetId → capability → decision. */
type PermissionsDoc = Record<string, Partial<Record<string, PermissionDecision>>>

export interface WidgetPermissionsStoreOptions {
  adapter: StorageAdapter
  /** Storage key. Default 'cyberdeck.widget.permissions'. */
  key?: string
}

const DEFAULT_KEY = 'cyberdeck.widget.permissions'

export class WidgetPermissionsStore {
  private readonly adapter: StorageAdapter
  private readonly key: string
  private doc: PermissionsDoc
  private readonly listeners = new Set<() => void>()

  constructor(options: WidgetPermissionsStoreOptions) {
    this.adapter = options.adapter
    this.key = options.key ?? DEFAULT_KEY
    this.doc = this.read()
  }

  /** Current decision for a capability, or 'unset' if the user hasn't chosen. */
  decision(widgetId: string, capability: WidgetCapability): PermissionState {
    return this.doc[widgetId]?.[capability] ?? 'unset'
  }

  isGranted(widgetId: string, capability: WidgetCapability): boolean {
    return this.decision(widgetId, capability) === 'granted'
  }

  grant(widgetId: string, capability: WidgetCapability): void {
    this.set(widgetId, capability, 'granted')
  }

  deny(widgetId: string, capability: WidgetCapability): void {
    this.set(widgetId, capability, 'denied')
  }

  /** Clear a decision (back to 'unset' → will re-prompt on next use). */
  reset(widgetId: string, capability: WidgetCapability): void {
    const forWidget = this.doc[widgetId]
    if (!forWidget || !(capability in forWidget)) return
    delete forWidget[capability]
    if (Object.keys(forWidget).length === 0) delete this.doc[widgetId]
    this.persist()
    this.notify()
  }

  /** All recorded decisions for a widget (for the inspector list). */
  decisionsFor(widgetId: string): Array<{ capability: string; decision: PermissionDecision }> {
    const forWidget = this.doc[widgetId] ?? {}
    return Object.entries(forWidget)
      .filter((entry): entry is [string, PermissionDecision] => entry[1] != null)
      .map(([capability, decision]) => ({ capability, decision }))
  }

  /** Every widget with a recorded decision (Platform Inspector perms tab). */
  widgetIds(): string[] {
    return Object.keys(this.doc)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Stable snapshot reference for useSyncExternalStore (identity changes on write). */
  snapshot(): PermissionsDoc {
    return this.doc
  }

  private set(widgetId: string, capability: WidgetCapability, decision: PermissionDecision): void {
    const forWidget = this.doc[widgetId] ?? {}
    forWidget[capability] = decision
    this.doc[widgetId] = forWidget
    // New object identity so useSyncExternalStore sees the change.
    this.doc = { ...this.doc }
    this.persist()
    this.notify()
  }

  private read(): PermissionsDoc {
    const raw = this.adapter.get(this.key)
    if (raw == null) return {}
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as PermissionsDoc) : {}
    } catch {
      return {} // corrupt storage → empty policy, never a crash
    }
  }

  private persist(): void {
    this.adapter.set(this.key, JSON.stringify(this.doc))
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
