// Undo/redo engine (CD-123). A history stack of reversible actions with gesture
// coalescing (rapid same-key edits collapse to one step), jump-to-index, and a
// depth cap. The History Store is intentionally in-memory only (design STORES:
// undo stack not persisted). `execUndoable(label, apply)` is the ergonomic entry:
// `apply` performs the change and RETURNS its inverse; the helper returns a toast
// payload ("<label> — ⌘Z to undo").

/** apply() performs the change and returns a function that reverts it. */
export type Apply = () => () => void

interface Entry {
  label: string
  icon?: string
  time: number
  apply: Apply
  /** current inverse — restores the state to before this entry was applied. */
  inverse: () => void
  coalesceKey?: string
}

export interface UndoableOptions {
  icon?: string
  /** Rapid consecutive entries with the same key coalesce into one step. */
  coalesceKey?: string
}

export interface UndoToast {
  label: string
  message: string
}

export interface HistoryItem {
  label: string
  icon?: string
  time: number
  applied: boolean
}

export interface UndoStackOptions {
  /** Max entries retained; oldest are dropped past this. Default 100. */
  cap?: number
  /** Coalesce window (ms) for same-key entries. Default 1000. */
  coalesceWindowMs?: number
  /** Injected clock (ms). Default Date.now via performance.now fallback. */
  now?: () => number
}

export class UndoStack {
  private readonly entries: Entry[] = []
  /** Number of applied entries (entries[0..pointer-1] are applied). */
  private pointer = 0
  private readonly cap: number
  private readonly coalesceWindowMs: number
  private readonly now: () => number

  constructor(options: UndoStackOptions = {}) {
    this.cap = options.cap ?? 100
    this.coalesceWindowMs = options.coalesceWindowMs ?? 1000
    this.now = options.now ?? (() => performance.now())
  }

  get canUndo(): boolean {
    return this.pointer > 0
  }
  get canRedo(): boolean {
    return this.pointer < this.entries.length
  }
  /** Current position in history (0 = initial state). */
  get index(): number {
    return this.pointer
  }
  get length(): number {
    return this.entries.length
  }
  list(): HistoryItem[] {
    return this.entries.map((e, i) => ({
      label: e.label,
      icon: e.icon,
      time: e.time,
      applied: i < this.pointer,
    }))
  }

  /**
   * Apply a reversible change and record it. `apply` runs immediately and returns
   * its inverse. Returns a toast payload for the "— ⌘Z to undo" surface.
   */
  execUndoable(label: string, apply: Apply, options: UndoableOptions = {}): UndoToast {
    const inverse = apply()
    const now = this.now()

    // Coalesce: same key as the current top entry within the window → fold in.
    const top = this.entries[this.pointer - 1]
    if (
      options.coalesceKey &&
      top &&
      this.pointer === this.entries.length &&
      top.coalesceKey === options.coalesceKey &&
      now - top.time <= this.coalesceWindowMs
    ) {
      // Keep the ORIGINAL inverse (reverts to before the gesture started); adopt
      // the latest apply so redo re-applies the final value.
      top.apply = apply
      top.time = now
      top.label = label
      return this.toast(label)
    }

    // Truncate any redo tail, then push.
    this.entries.length = this.pointer
    this.entries.push({
      label,
      icon: options.icon,
      time: now,
      apply,
      inverse,
      coalesceKey: options.coalesceKey,
    })
    this.pointer++
    this.enforceCap()
    return this.toast(label)
  }

  undo(): boolean {
    if (!this.canUndo) return false
    const entry = this.entries[this.pointer - 1]!
    entry.inverse()
    this.pointer--
    return true
  }

  redo(): boolean {
    if (!this.canRedo) return false
    const entry = this.entries[this.pointer]!
    entry.inverse = entry.apply() // re-apply, refreshing the inverse
    this.pointer++
    return true
  }

  /** Undo/redo until the applied count equals `target` (jump-to-index). */
  jumpTo(target: number): void {
    const clamped = Math.max(0, Math.min(target, this.entries.length))
    while (this.pointer > clamped) this.undo()
    while (this.pointer < clamped) this.redo()
  }

  clear(): void {
    this.entries.length = 0
    this.pointer = 0
  }

  private enforceCap(): void {
    while (this.entries.length > this.cap) {
      this.entries.shift()
      this.pointer-- // an applied entry fell off the bottom
    }
  }

  private toast(label: string): UndoToast {
    return { label, message: `${label} — ⌘Z to undo` }
  }
}
