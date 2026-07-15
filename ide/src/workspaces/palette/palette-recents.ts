// Palette recents (CD-207): a small persisted MRU list of command ids so recently
// used commands float to the top of the palette's empty-query view.
import type { StorageAdapter } from '@/services/persistence'

const DEFAULT_KEY = 'cdk-palette-recents'
const DEFAULT_CAP = 8

export class PaletteRecents {
  private ids: string[]
  private readonly storage?: StorageAdapter
  private readonly key: string
  private readonly cap: number

  constructor(options: { storage?: StorageAdapter; key?: string; cap?: number } = {}) {
    this.storage = options.storage
    this.key = options.key ?? DEFAULT_KEY
    this.cap = options.cap ?? DEFAULT_CAP
    this.ids = this.load()
  }

  /** Move `id` to the front (most-recent), capped, and persist. */
  record(id: string): void {
    this.ids = [id, ...this.ids.filter((x) => x !== id)].slice(0, this.cap)
    this.persist()
  }

  /** Most-recent-first list of command ids. */
  list(): string[] {
    return [...this.ids]
  }

  private load(): string[] {
    const raw = this.storage?.get(this.key)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as string[]).slice(0, this.cap) : []
    } catch {
      return []
    }
  }

  private persist(): void {
    this.storage?.set(this.key, JSON.stringify(this.ids))
  }
}
