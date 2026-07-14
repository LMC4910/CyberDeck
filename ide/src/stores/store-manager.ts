// StoreManager (CD-130). Coordinates restore ordering (per each store's
// restoreAt) and write-behind for persisted kinds. A corrupt persisted blob
// falls back to the store's current (initial) state with a notice, never
// crashing boot. Uses the CD-118 StorageAdapter + a debounced writer.
import type { StorageAdapter } from '@/services/persistence'
import type { RestoreAt, Store } from './store-base'

export interface StoreNotice {
  code: 'corrupt-blob'
  name: string
  message: string
}

export interface StoreManagerOptions {
  adapter: StorageAdapter
  onNotice?: (notice: StoreNotice) => void
  /** Debounced write scheduler (tests inject synchronous). */
  scheduler?: (fn: () => void, ms: number) => () => void
  debounceMs?: number
}

const RESTORE_ORDER: RestoreAt[] = ['boot-blocking', 'boot', 'after-shell', 'lazy']

export class StoreManager {
  private readonly adapter: StorageAdapter
  private readonly onNotice?: (n: StoreNotice) => void
  private readonly scheduler: (fn: () => void, ms: number) => () => void
  private readonly debounceMs: number
  private readonly stores: Array<Store<unknown>> = []
  private readonly pending = new Map<string, { cancel: () => void; write: () => void }>()

  constructor(options: StoreManagerOptions) {
    this.adapter = options.adapter
    this.onNotice = options.onNotice
    this.scheduler = options.scheduler ?? ((fn, ms) => {
      const h = setTimeout(fn, ms)
      return () => clearTimeout(h)
    })
    this.debounceMs = options.debounceMs ?? 400
  }

  /** Register a store; persisted kinds get write-behind wired on registration. */
  register<S>(store: Store<S>): void {
    this.stores.push(store as Store<unknown>)
    if (store.descriptor.kind === 'persisted' && store.descriptor.location) {
      store.subscribe(() => this.scheduleWrite(store as Store<unknown>))
    }
  }

  /** Restore all persisted stores in restoreAt order. Returns the applied order. */
  restore(): string[] {
    const order: string[] = []
    for (const stage of RESTORE_ORDER) {
      for (const store of this.stores) {
        if (store.descriptor.kind !== 'persisted' || !store.descriptor.location) continue
        if ((store.descriptor.restoreAt ?? 'boot') !== stage) continue
        this.restoreOne(store)
        order.push(store.descriptor.name)
      }
    }
    return order
  }

  /** Flush pending write-behind saves immediately (flush-on-quit). */
  flush(): void {
    for (const { cancel, write } of [...this.pending.values()]) {
      cancel()
      write()
    }
    this.pending.clear()
  }

  private restoreOne(store: Store<unknown>): void {
    const key = store.descriptor.location!
    const raw = this.adapter.get(key)
    if (raw == null) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.onNotice?.({ code: 'corrupt-blob', name: store.descriptor.name, message: `corrupt blob for "${key}"` })
      return // keep initial state — no crash
    }
    try {
      const state = store.descriptor.migrate ? store.descriptor.migrate(parsed) : parsed
      store.hydrate(state)
    } catch (err) {
      this.onNotice?.({
        code: 'corrupt-blob',
        name: store.descriptor.name,
        message: `migration failed for "${key}": ${String(err)}`,
      })
    }
  }

  private scheduleWrite(store: Store<unknown>): void {
    const key = store.descriptor.location!
    this.pending.get(key)?.cancel()
    const write = () => {
      this.pending.delete(key)
      this.adapter.set(key, JSON.stringify(store.getState()))
    }
    // Register before scheduling so a synchronous scheduler (tests) is safe.
    this.pending.set(key, { cancel: () => {}, write })
    const cancel = this.scheduler(write, this.debounceMs)
    const entry = this.pending.get(key)
    if (entry) entry.cancel = cancel
  }
}
