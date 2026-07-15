// WorkspaceService (CD-202). Workspaces are config contributions
// {id, label, icon, order, lazyPane} — adding one is a registration, never a
// shell rewrite. The service owns the active-workspace routing state and emits
// WorkspaceChanged; it is store-agnostic (services may not import stores), so the
// app-shell wiring mirrors active↔Workspace store and bridges onChanged→EventBus.

/** A lazily-loaded pane module (dynamic import → { default: Component }). */
export type PaneLoader = () => Promise<{ default: unknown }>

export interface WorkspaceContribution {
  id: string
  label: string
  icon: string
  order: number
  lazyPane: PaneLoader
}

export class InvalidWorkspaceError extends Error {
  constructor(reason: string) {
    super(`invalid workspace contribution: ${reason}`)
    this.name = 'InvalidWorkspaceError'
  }
}
export class DuplicateWorkspaceError extends Error {
  constructor(id: string) {
    super(`workspace "${id}" is already registered`)
    this.name = 'DuplicateWorkspaceError'
  }
}
export class UnknownWorkspaceError extends Error {
  constructor(id: string) {
    super(`no workspace registered with id "${id}"`)
    this.name = 'UnknownWorkspaceError'
  }
}

const ID_RE = /^[a-z][a-z0-9-]*$/

export interface WorkspaceServiceOptions {
  /** Emitted after a route change (wiring bridges to WorkspaceChanged on the bus). */
  onChanged?: (id: string) => void
}

export class WorkspaceService {
  private readonly workspaces = new Map<string, WorkspaceContribution>()
  private readonly listeners = new Set<(id: string) => void>()
  private readonly onChanged?: (id: string) => void
  private activeId: string | null = null

  constructor(options: WorkspaceServiceOptions = {}) {
    this.onChanged = options.onChanged
  }

  register(contribution: WorkspaceContribution): void {
    this.validate(contribution)
    if (this.workspaces.has(contribution.id)) throw new DuplicateWorkspaceError(contribution.id)
    this.workspaces.set(contribution.id, contribution)
    // first registered workspace becomes active by default
    if (this.activeId === null) this.activeId = contribution.id
  }

  registerAll(contributions: WorkspaceContribution[]): void {
    for (const c of contributions) this.register(c)
  }

  /** Contributions sorted by declared order. */
  list(): WorkspaceContribution[] {
    return [...this.workspaces.values()].sort((a, b) => a.order - b.order)
  }

  get(id: string): WorkspaceContribution | undefined {
    return this.workspaces.get(id)
  }

  active(): string | null {
    return this.activeId
  }

  /** Route to a workspace: sets active, notifies subscribers, emits WorkspaceChanged. */
  setActive(id: string): void {
    if (!this.workspaces.has(id)) throw new UnknownWorkspaceError(id)
    if (id === this.activeId) return
    this.activeId = id
    for (const l of this.listeners) l(id)
    this.onChanged?.(id)
  }

  subscribe(listener: (id: string) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private validate(c: WorkspaceContribution): void {
    if (!ID_RE.test(c.id)) throw new InvalidWorkspaceError(`bad id "${c.id}" (must match ${ID_RE})`)
    if (!c.label?.trim()) throw new InvalidWorkspaceError(`"${c.id}" has no label`)
    if (!c.icon?.trim()) throw new InvalidWorkspaceError(`"${c.id}" has no icon`)
    if (typeof c.order !== 'number' || Number.isNaN(c.order)) {
      throw new InvalidWorkspaceError(`"${c.id}" has a non-numeric order`)
    }
    if (typeof c.lazyPane !== 'function') {
      throw new InvalidWorkspaceError(`"${c.id}" lazyPane must be a function`)
    }
  }
}
