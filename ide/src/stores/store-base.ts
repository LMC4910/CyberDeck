// Store base + persistence contract (CD-130). A minimal observable store with
// subscribe/select; each store declares {kind, location, restoreAt, migrate} so
// the StoreManager knows when to restore it and whether to write it behind. The
// design's 13 STORES map onto these kinds. The React binding is in use-store.ts.

export type StoreKind = 'temp' | 'persisted' | 'derived' | 'cached' | 'server'

/** When a persisted store is restored during boot (BOOTSEQ ordering). */
export type RestoreAt = 'boot-blocking' | 'boot' | 'after-shell' | 'lazy'

export interface StoreDescriptor<S = unknown> {
  name: string
  kind: StoreKind
  /** Storage key for persisted kinds. */
  location?: string
  restoreAt?: RestoreAt
  /** Migrate a raw persisted blob to the current state shape. */
  migrate?: (raw: unknown) => S
}

export type Listener = () => void
export type Updater<S> = S | ((prev: S) => S)

export interface Store<S> {
  readonly descriptor: StoreDescriptor<S>
  getState(): S
  setState(updater: Updater<S>): void
  subscribe(listener: Listener): () => void
  /** Compute a derived slice (memoization is per-consumer in useStore). */
  select<T>(selector: (state: S) => T): T
  /** Replace state from a restored/migrated blob without notifying persistence. */
  hydrate(state: S): void
}

class StoreImpl<S> implements Store<S> {
  readonly descriptor: StoreDescriptor<S>
  private state: S
  private readonly listeners = new Set<Listener>()

  constructor(initial: S, descriptor: StoreDescriptor<S>) {
    this.state = initial
    this.descriptor = descriptor
  }

  getState(): S {
    return this.state
  }

  setState(updater: Updater<S>): void {
    const next =
      typeof updater === 'function' ? (updater as (prev: S) => S)(this.state) : updater
    if (Object.is(next, this.state)) return
    this.state = next
    for (const l of this.listeners) l()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  select<T>(selector: (state: S) => T): T {
    return selector(this.state)
  }

  hydrate(state: S): void {
    this.state = state
    for (const l of this.listeners) l()
  }
}

export function createStore<S>(initial: S, descriptor: StoreDescriptor<S>): Store<S> {
  return new StoreImpl(initial, descriptor)
}
