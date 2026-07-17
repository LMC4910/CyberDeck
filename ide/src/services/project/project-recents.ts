// Project recents (CD-406): a small persisted MRU list of opened projects so the
// Projects dashboard — the first-boot landing surface — has something useful to
// offer on a cold start. Mirrors the palette's recents (CD-207): storage is
// injected, a corrupt blob degrades to an empty list rather than throwing.
import type { StorageAdapter } from '@/services/persistence'

const DEFAULT_KEY = 'cdk-project-recents'
const DEFAULT_CAP = 6

export interface RecentProject {
  id: string
  name: string
  /** ISO timestamp of the most recent open. */
  openedAt: string
}

export interface ProjectRecentsOptions {
  storage?: StorageAdapter
  key?: string
  cap?: number
}

export class ProjectRecents {
  /** Replaced wholesale on every change, never mutated in place — so `list()` is a
   *  stable snapshot a useSyncExternalStore subscriber can compare by reference. */
  private entries: readonly RecentProject[]
  private readonly storage?: StorageAdapter
  private readonly key: string
  private readonly cap: number
  private readonly listeners = new Set<() => void>()

  constructor(options: ProjectRecentsOptions = {}) {
    this.storage = options.storage
    this.key = options.key ?? DEFAULT_KEY
    this.cap = options.cap ?? DEFAULT_CAP
    this.entries = this.load()
  }

  /** Move `entry` to the front (most-recent), capped, and persist. */
  record(entry: RecentProject): void {
    this.entries = [entry, ...this.entries.filter((e) => e.id !== entry.id)].slice(0, this.cap)
    this.commit()
  }

  /** Drop a project from the list (e.g. after it is deleted). */
  remove(id: string): void {
    const next = this.entries.filter((e) => e.id !== id)
    if (next.length === this.entries.length) return
    this.entries = next
    this.commit()
  }

  /** Most-recent-first. The same reference until the list actually changes. */
  list(): readonly RecentProject[] {
    return this.entries
  }

  /** Notified after any change, so a view can re-read the list. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private commit(): void {
    this.storage?.set(this.key, JSON.stringify(this.entries))
    for (const l of this.listeners) l()
  }

  private load(): readonly RecentProject[] {
    const raw = this.storage?.get(this.key)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isRecent).slice(0, this.cap)
    } catch {
      return []
    }
  }
}

function isRecent(value: unknown): value is RecentProject {
  const e = value as Partial<RecentProject> | null
  return !!e && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.openedAt === 'string'
}
