// DockManager (CD-214). A tool-window state machine: each window is
// {mode: float|docked, side, size, pinned, autohidden}. Transitions are
// float↔dock, pin/unpin, auto-hide/peek/re-pin, resize, move-zone. Illegal
// transitions are rejected (throw) so the UI can rely on a valid model. State is
// serializable → persisted as rows in the Workspace store.

export type DockMode = 'float' | 'docked'
export type DockSide = 'left' | 'right' | 'bottom'

export interface ToolWindow {
  id: string
  mode: DockMode
  side: DockSide
  size: number
  /** Docked windows can be pinned (inset content) or unpinned (edge tab). */
  pinned: boolean
  /** Unpinned windows can be auto-hidden (collapsed) or peeking (temporary show). */
  autohidden: boolean
  peeking: boolean
}

export interface DockRegistration {
  id: string
  defaultSide: DockSide
  minSize: number
  defaultSize?: number
}

export class DockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DockError'
  }
}

export class DockManager {
  private readonly windows = new Map<string, ToolWindow>()
  private readonly minSizes = new Map<string, number>()

  /** Register a tool window (declarative — CD-216). Docked+pinned by default. */
  register(reg: DockRegistration): ToolWindow {
    if (this.windows.has(reg.id)) throw new DockError(`tool window "${reg.id}" already registered`)
    this.minSizes.set(reg.id, reg.minSize)
    const win: ToolWindow = {
      id: reg.id,
      mode: 'docked',
      side: reg.defaultSide,
      size: Math.max(reg.minSize, reg.defaultSize ?? reg.minSize),
      pinned: true,
      autohidden: false,
      peeking: false,
    }
    this.windows.set(reg.id, win)
    return { ...win }
  }

  get(id: string): ToolWindow | undefined {
    const w = this.windows.get(id)
    return w ? { ...w } : undefined
  }

  list(): ToolWindow[] {
    return [...this.windows.values()].map((w) => ({ ...w }))
  }

  /** Float a docked window (loses pin/auto-hide state). */
  float(id: string): ToolWindow {
    const w = this.require(id)
    if (w.mode === 'float') throw new DockError(`"${id}" is already floating`)
    return this.set(id, { mode: 'float', pinned: false, autohidden: false, peeking: false })
  }

  /** Dock a floating window to a side (pinned by default). */
  dock(id: string, side: DockSide): ToolWindow {
    const w = this.require(id)
    if (w.mode === 'docked' && w.side === side) throw new DockError(`"${id}" is already docked ${side}`)
    return this.set(id, { mode: 'docked', side, pinned: true, autohidden: false, peeking: false })
  }

  /** Move a docked window to another zone/side. */
  moveZone(id: string, side: DockSide): ToolWindow {
    const w = this.require(id)
    if (w.mode !== 'docked') throw new DockError(`only docked windows move zones ("${id}" is ${w.mode})`)
    return this.set(id, { side })
  }

  /** Pin a docked window (content inset). */
  pin(id: string): ToolWindow {
    const w = this.require(id)
    if (w.mode !== 'docked') throw new DockError(`only docked windows pin ("${id}" is ${w.mode})`)
    if (w.pinned) throw new DockError(`"${id}" is already pinned`)
    return this.set(id, { pinned: true, autohidden: false, peeking: false })
  }

  /** Unpin a docked window (collapses to an edge tab, auto-hidden). */
  unpin(id: string): ToolWindow {
    const w = this.require(id)
    if (w.mode !== 'docked') throw new DockError(`only docked windows unpin ("${id}" is ${w.mode})`)
    if (!w.pinned) throw new DockError(`"${id}" is already unpinned`)
    return this.set(id, { pinned: false, autohidden: true, peeking: false })
  }

  /** Peek an auto-hidden window (temporary show on hover). */
  peek(id: string): ToolWindow {
    const w = this.require(id)
    if (w.pinned || !w.autohidden) throw new DockError(`only auto-hidden windows peek ("${id}")`)
    return this.set(id, { peeking: true })
  }

  /** End a peek (collapse back to the edge tab). */
  unpeek(id: string): ToolWindow {
    const w = this.require(id)
    if (!w.peeking) throw new DockError(`"${id}" is not peeking`)
    return this.set(id, { peeking: false })
  }

  /** Resize a window (clamped to its registered minSize). */
  resize(id: string, size: number): ToolWindow {
    this.require(id)
    const min = this.minSizes.get(id) ?? 0
    return this.set(id, { size: Math.max(min, Math.round(size)) })
  }

  /** Restore serialized rows (from the Workspace store) — replaces state. */
  hydrate(rows: ToolWindow[]): void {
    for (const row of rows) {
      this.windows.set(row.id, { ...row })
      if (!this.minSizes.has(row.id)) this.minSizes.set(row.id, 0)
    }
  }

  /** Serializable rows for persistence. */
  serialize(): ToolWindow[] {
    return this.list()
  }

  private require(id: string): ToolWindow {
    const w = this.windows.get(id)
    if (!w) throw new DockError(`no tool window "${id}"`)
    return w
  }

  private set(id: string, patch: Partial<ToolWindow>): ToolWindow {
    const w = this.windows.get(id)!
    const next = { ...w, ...patch }
    this.windows.set(id, next)
    return { ...next }
  }
}
