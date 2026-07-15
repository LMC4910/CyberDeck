// SessionManager (CD-212). Persists the session blob (active workspace, selection,
// zoom) debounced and restores it at boot stage 4. A corrupt blob falls back to
// defaults with a notice instead of crashing. Backed by an injected StorageAdapter
// (browser-backed in-app, memory in tests).
import type { StorageAdapter } from '@/services/persistence'

const KEY = 'cdk-session'
const VERSION = 1

export interface SessionBlob {
  version: number
  activeWorkspace?: string
  selection?: string[]
  zoom?: number
}

export interface SessionNotice {
  code: 'corrupt-session'
  message: string
}

export interface SessionManagerOptions {
  adapter: StorageAdapter
  onNotice?: (notice: SessionNotice) => void
  scheduler?: (fn: () => void, ms: number) => () => void
  debounceMs?: number
}

export class SessionManager {
  private readonly adapter: StorageAdapter
  private readonly onNotice?: (n: SessionNotice) => void
  private readonly scheduler: (fn: () => void, ms: number) => () => void
  private readonly debounceMs: number
  private pending?: { blob: SessionBlob; cancel: () => void }

  constructor(options: SessionManagerOptions) {
    this.adapter = options.adapter
    this.onNotice = options.onNotice
    this.scheduler = options.scheduler ?? ((fn, ms) => {
      const h = setTimeout(fn, ms)
      return () => clearTimeout(h)
    })
    this.debounceMs = options.debounceMs ?? 400
  }

  /** Load the session blob; null (use defaults) when absent or corrupt (+ notice). */
  load(): SessionBlob | null {
    const raw = this.adapter.get(KEY)
    if (raw == null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      this.notice('could not parse the stored session')
      return null
    }
    if (!isSessionBlob(parsed)) {
      this.notice('stored session has an unexpected shape')
      return null
    }
    if (parsed.version !== VERSION) {
      this.notice(`stored session version ${parsed.version} != ${VERSION}`)
      return null
    }
    return parsed
  }

  /** Queue a debounced session write. */
  save(blob: Omit<SessionBlob, 'version'>): void {
    this.pending?.cancel()
    const full: SessionBlob = { version: VERSION, ...blob }
    const entry = { blob: full, cancel: () => {} }
    this.pending = entry
    entry.cancel = this.scheduler(() => this.writeNow(), this.debounceMs)
  }

  /** Flush a pending write immediately (flush-on-quit). */
  flush(): void {
    this.writeNow()
  }

  private writeNow(): void {
    if (!this.pending) return
    const { blob, cancel } = this.pending
    cancel()
    this.pending = undefined
    this.adapter.set(KEY, JSON.stringify(blob))
  }

  private notice(message: string): void {
    this.onNotice?.({ code: 'corrupt-session', message })
  }
}

function isSessionBlob(v: unknown): v is SessionBlob {
  return typeof v === 'object' && v !== null && 'version' in v && typeof (v as SessionBlob).version === 'number'
}
