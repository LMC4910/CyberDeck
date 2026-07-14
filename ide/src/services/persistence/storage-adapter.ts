// Storage adapters (CD-118). The persistence layer talks to storage only through
// this interface, so localStorage today swaps for a Tauri fs adapter later with
// no change to ConfigPersistence.

export interface StorageAdapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/** In-memory adapter — the default for tests and SSR/no-DOM contexts. */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>()

  constructor(seed?: Record<string, string>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.store.set(k, v)
  }

  get(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  set(key: string, value: string): void {
    this.store.set(key, value)
  }
  remove(key: string): void {
    this.store.delete(key)
  }
}

/**
 * Browser localStorage adapter. Falls back to an internal memory map when
 * localStorage is unavailable or throws (private mode / quota / no DOM) so the
 * app never crashes on a storage failure.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly fallback = new MemoryStorageAdapter()

  private get ls(): Storage | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null
    } catch {
      return null
    }
  }

  get(key: string): string | null {
    try {
      return this.ls?.getItem(key) ?? this.fallback.get(key)
    } catch {
      return this.fallback.get(key)
    }
  }
  set(key: string, value: string): void {
    try {
      this.ls?.setItem(key, value)
    } catch {
      this.fallback.set(key, value)
    }
  }
  remove(key: string): void {
    try {
      this.ls?.removeItem(key)
    } catch {
      this.fallback.remove(key)
    }
  }
}
