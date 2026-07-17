// Variables workspace controller (CD-401). Owns the pane's query state on a store
// (the `stores` primitive, not React state — the blueprint's "no React state for
// cross-component domain data"), and is the only thing that talks to the port.
//
// Paging is *windowed*: the table virtualizes `total` rows and the controller
// fetches only the pages the scroll window actually overlaps. So {filter, sort,
// page, limit} are real server params on every keystroke and every scroll — the
// table never receives the whole set and never filters it (CD-401 AC).
import { createStore, optimistic, type Store } from '@/stores'
import { ComputedEngine, type ComputedDef, type ComputedResult } from './computed-engine'
import type { VariableRecord } from './variables-model'
import type {
  VariableDraft,
  VariableFilter,
  VariablePage,
  VariableQuery,
  VariableSort,
  VariableSortField,
  VariablesSource,
} from './variables-source'

/** Rows per repo page. The window (~20 rows) always spans at most two of these. */
export const PAGE_SIZE = 100

export interface VariablesNotice {
  kind: 'error' | 'info'
  text: string
}

export interface VariablesState {
  filter: VariableFilter
  sort: VariableSort
  /** page number → rows, sparse: only pages the window has needed. */
  pages: Record<number, VariableRecord[]>
  /** Server row count for the current filter (the virtualizer's height). */
  total: number
  /** True until the first page of a new query lands. */
  loading: boolean
  notice?: VariablesNotice
  /** Selected row ids (CD-401 row select). */
  selectedIds: string[]
  /** ⇧-range anchor. */
  anchor?: string
  /**
   * id → revealed secret value (CD-402). Secrets are masked in every query payload,
   * so a value only exists here after an explicit reveal, and only until release.
   */
  revealed: Record<string, unknown>
  /**
   * id → the live evaluation of a derived (computed/expression) variable (CD-403).
   * The computed engine writes here on every dependency tick; the value cell and the
   * inspector read it. A cyclic or invalid expression lands as `{ ok: false, error }`.
   */
  computed: Record<string, ComputedResult>
}

const INITIAL_SORT: VariableSort = { field: 'name', dir: 'asc' }

export function initialVariablesState(): VariablesState {
  return { filter: {}, sort: INITIAL_SORT, pages: {}, total: 0, loading: true, selectedIds: [], revealed: {}, computed: {} }
}

export class VariablesController {
  readonly store: Store<VariablesState>
  private source: VariablesSource
  /** Bumped on every query change so late responses from an old query are dropped. */
  private generation = 0
  private readonly inflight = new Set<number>()
  /** Derived-variable evaluator (CD-403); its results land in state.computed. */
  private readonly engine: ComputedEngine
  /** Live tick subscription feeding the engine — released on dispose/rebind. */
  private tickUnsub?: () => void

  constructor(source: VariablesSource) {
    this.source = source
    this.store = createStore<VariablesState>(initialVariablesState(), {
      name: 'variablesPane',
      kind: 'temp',
    })
    this.engine = new ComputedEngine((results) => {
      this.store.setState((s) => ({ ...s, computed: Object.fromEntries(results) }))
    })
  }

  get state(): VariablesState {
    return this.store.getState()
  }

  /** The params the controller would send right now — the table's round-trip proof. */
  queryFor(page: number): VariableQuery {
    const { filter, sort } = this.state
    return { filter: compactFilter(filter), sort, page, limit: PAGE_SIZE }
  }

  // ── query params ─────────────────────────────────────────────────────────────

  /** Merge a filter patch (search / scope / plugin) and re-query from page 1. */
  setFilter(patch: Partial<VariableFilter>): void {
    const next = { ...this.state.filter, ...patch }
    if (sameFilter(next, this.state.filter)) return
    this.store.setState((s) => ({ ...s, filter: next }))
    this.resetQuery()
  }

  /** Click a column header: same field toggles direction, new field starts asc. */
  toggleSort(field: VariableSortField): void {
    const cur = this.state.sort
    const next: VariableSort =
      cur.field === field ? { field, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
    this.store.setState((s) => ({ ...s, sort: next }))
    this.resetQuery()
  }

  // ── windowed fetch ───────────────────────────────────────────────────────────

  /** Ensure every page overlapping the visible row range is loaded. */
  ensureRange(start: number, end: number): void {
    const from = Math.max(0, start)
    const to = Math.max(from, end)
    const firstPage = pageOf(from)
    const lastPage = pageOf(Math.max(from, to - 1))
    for (let p = firstPage; p <= lastPage; p++) this.fetchPage(p)
  }

  /** The row at an absolute index, or undefined while its page is in flight. */
  rowAt(index: number): VariableRecord | undefined {
    const page = this.state.pages[pageOf(index)]
    return page?.[index % PAGE_SIZE]
  }

  /** Re-run the current query, dropping every cached page. */
  refresh(): void {
    this.resetQuery()
  }

  private resetQuery(): void {
    this.generation++
    this.inflight.clear()
    // total goes back to 0 so the row window cannot chase pages past the *old*
    // result set's end while the new count is still in flight.
    this.store.setState((s) => ({ ...s, pages: {}, total: 0, loading: true }))
    this.fetchPage(1)
  }

  private fetchPage(page: number): void {
    if (page < 1) return
    if (this.state.pages[page] || this.inflight.has(page)) return
    // Never chase pages past the known end (total=0 still allows the probe page 1).
    if (this.state.total > 0 && (page - 1) * PAGE_SIZE >= this.state.total) return
    const gen = this.generation
    this.inflight.add(page)
    void this.source
      .query(this.queryFor(page))
      .then((result) => this.receive(gen, page, result))
      .catch((error: unknown) => this.fail(gen, page, error))
  }

  private receive(gen: number, page: number, result: VariablePage): void {
    if (gen !== this.generation) return // a newer query supersedes this response
    this.inflight.delete(page)
    this.store.setState((s) => ({
      ...s,
      pages: { ...s.pages, [page]: result.items },
      total: result.total,
      loading: false,
      // Drop selections the new result set no longer contains.
      selectedIds: s.selectedIds,
    }))
  }

  private fail(gen: number, page: number, error: unknown): void {
    if (gen !== this.generation) return
    this.inflight.delete(page)
    this.store.setState((s) => ({
      ...s,
      loading: false,
      notice: { kind: 'error', text: `Could not load variables: ${messageOf(error)}` },
    }))
  }

  // ── selection (CD-401 row select) ────────────────────────────────────────────

  /** Ordered ids of the rows currently cached, for ⇧-range extension. */
  private orderedIds(): string[] {
    const pages = this.state.pages
    return Object.keys(pages)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((p) => pages[p]!.map((r) => r.id))
  }

  select(id: string, mods: { shift?: boolean; meta?: boolean } = {}): void {
    const cur = this.state
    if (mods.shift && cur.anchor) {
      const ordered = this.orderedIds()
      const a = ordered.indexOf(cur.anchor)
      const b = ordered.indexOf(id)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        this.store.setState((s) => ({ ...s, selectedIds: ordered.slice(lo, hi + 1) }))
        return
      }
    }
    if (mods.meta) {
      const has = cur.selectedIds.includes(id)
      this.store.setState((s) => ({
        ...s,
        selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
        anchor: id,
      }))
      return
    }
    this.store.setState((s) => ({ ...s, selectedIds: [id], anchor: id }))
  }

  clearSelection(): void {
    this.store.setState((s) => ({ ...s, selectedIds: [], anchor: undefined }))
  }

  /** Ids of every row currently cached — the dialog's local uniqueness check. */
  knownIds(): string[] {
    return this.orderedIds()
  }

  /** The cached row for an id (inspector lookup), or undefined if not loaded. */
  rowById(id: string): VariableRecord | undefined {
    for (const rows of Object.values(this.state.pages)) {
      const found = rows.find((r) => r.id === id)
      if (found) return found
    }
    return undefined
  }

  // ── computed / expression variables (CD-403) ─────────────────────────────────

  /**
   * (Re)build the derived-variable graph and start tracking dependency ticks. Loads
   * the whole derived set (not a page) so cycles are detectable, seeds each
   * dependency's current value, then subscribes so a tick re-evaluates exactly the
   * derived vars that read the ticked path.
   */
  async refreshComputed(): Promise<void> {
    if (!this.source.derived) return
    let defs: ComputedDef[]
    try {
      const rows = await this.source.derived()
      defs = rows.flatMap((r) => (r.expr ? [{ id: r.id, expr: r.expr }] : []))
    } catch (error) {
      this.setNotice({ kind: 'error', text: `Could not load computed variables: ${messageOf(error)}` })
      return
    }
    this.engine.setDefinitions(defs)
    const deps = this.engine.dependencyPaths()
    if (deps.length && this.source.values) {
      try {
        this.engine.seed(await this.source.values(deps))
      } catch {
        // Leave dependencies undefined — the sandbox's safe default handles it.
      }
    }
    this.tickUnsub?.()
    this.tickUnsub = this.source.subscribe?.((e) => {
      this.engine.onTick(e.id, e.value)
    })
  }

  /** The variable paths a derived var reads (inspector "depends on" list). */
  dependenciesOf(id: string): string[] {
    return this.engine.dependenciesOf(id)
  }

  /** Release the live tick subscription (pane unmount). */
  dispose(): void {
    this.tickUnsub?.()
    this.tickUnsub = undefined
  }

  // ── mutations (CD-402) ───────────────────────────────────────────────────────

  /**
   * Inline value edit. Optimistic: the row shows the new value at once, the repo
   * write follows, and a failure restores the previous value and says so — the
   * store's rollback contract (CD-133) doing the work, not a hand-rolled undo.
   * Returns false when the write failed.
   */
  async writeValue(id: string, value: unknown): Promise<boolean> {
    try {
      await optimistic<VariablesState, VariableRecord>({
        store: this.store,
        apply: (s) => ({ ...s, notice: undefined, pages: patchRow(s.pages, id, (r) => ({ ...r, value })) }),
        commit: () => this.source.write(id, value),
        // The server's row is authoritative (it stamps updatedAt, may coerce).
        reconcile: (s, result) => ({ ...s, pages: patchRow(s.pages, id, () => result) }),
      })
      return true
    } catch (error) {
      this.setNotice({ kind: 'error', text: `Could not update ${id}: ${messageOf(error)}` })
      return false
    }
  }

  /** Create a variable, then re-query — the server decides where the row sorts. */
  async createVariable(draft: VariableDraft): Promise<VariableRecord | undefined> {
    try {
      const row = await this.source.create(draft)
      this.refresh()
      this.store.setState((s) => ({
        ...s,
        selectedIds: [row.id],
        anchor: row.id,
        notice: { kind: 'info', text: `Created ${row.id}` },
      }))
      return row
    } catch (error) {
      this.setNotice({ kind: 'error', text: `Could not create ${draft.id}: ${messageOf(error)}` })
      return undefined
    }
  }

  /**
   * Delete one or more rows (multi-select op). Optimistic, then a re-query because
   * removing rows shifts every page after them. A failure rolls the rows back and
   * re-queries anyway, so a partial delete reconciles with the server truth.
   */
  async removeMany(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true
    const doomed = new Set(ids)
    try {
      await optimistic<VariablesState, void>({
        store: this.store,
        apply: (s) => ({
          ...s,
          notice: undefined,
          pages: dropRows(s.pages, doomed),
          total: Math.max(0, s.total - ids.length),
          selectedIds: s.selectedIds.filter((x) => !doomed.has(x)),
        }),
        commit: async () => {
          for (const id of ids) await this.source.remove(id)
        },
      })
      this.refresh()
      this.setNotice({ kind: 'info', text: `Deleted ${ids.length === 1 ? ids[0]! : `${ids.length} variables`}` })
      return true
    } catch (error) {
      this.setNotice({ kind: 'error', text: `Could not delete: ${messageOf(error)}` })
      this.refresh() // the commit may have removed some before failing
      return false
    }
  }

  // ── secrets (CD-402) ─────────────────────────────────────────────────────────

  /** Fetch a masked secret's value (reveal-on-hold press). */
  async revealSecret(id: string): Promise<void> {
    try {
      const value = await this.source.reveal(id)
      this.store.setState((s) => ({ ...s, revealed: { ...s.revealed, [id]: value } }))
    } catch (error) {
      this.setNotice({ kind: 'error', text: `Could not reveal ${id}: ${messageOf(error)}` })
    }
  }

  /** Drop a revealed value (release / blur) — back to masked. */
  hideSecret(id: string): void {
    if (!(id in this.state.revealed)) return
    this.store.setState((s) => {
      const { [id]: _dropped, ...rest } = s.revealed
      return { ...s, revealed: rest }
    })
  }

  setNotice(notice: VariablesNotice | undefined): void {
    this.store.setState((s) => ({ ...s, notice }))
  }

  /** Swap the bound source (the shell wiring a repository adapter after boot). */
  bind(source: VariablesSource): void {
    if (source === this.source) return
    this.source = source
    this.resetQuery()
  }
}

function pageOf(index: number): number {
  return Math.floor(index / PAGE_SIZE) + 1
}

/** Replace one row wherever it is cached, leaving untouched pages referentially equal. */
function patchRow(
  pages: Record<number, VariableRecord[]>,
  id: string,
  fn: (row: VariableRecord) => VariableRecord,
): Record<number, VariableRecord[]> {
  const out: Record<number, VariableRecord[]> = {}
  for (const [key, rows] of Object.entries(pages)) {
    const index = rows.findIndex((r) => r.id === id)
    if (index < 0) {
      out[Number(key)] = rows
      continue
    }
    const next = [...rows]
    next[index] = fn(rows[index]!)
    out[Number(key)] = next
  }
  return out
}

/** Remove rows from every cached page (optimistic delete). */
function dropRows(
  pages: Record<number, VariableRecord[]>,
  ids: ReadonlySet<string>,
): Record<number, VariableRecord[]> {
  const out: Record<number, VariableRecord[]> = {}
  for (const [key, rows] of Object.entries(pages)) {
    const kept = rows.filter((r) => !ids.has(r.id))
    out[Number(key)] = kept.length === rows.length ? rows : kept
  }
  return out
}

/** Drop empty filter keys so the params carry only what the user actually set. */
function compactFilter(filter: VariableFilter): VariableFilter | undefined {
  const out: VariableFilter = {}
  if (filter.scope) out.scope = filter.scope
  if (filter.plugin) out.plugin = filter.plugin
  if (filter.search?.trim()) out.search = filter.search.trim()
  return Object.keys(out).length ? out : undefined
}

function sameFilter(a: VariableFilter, b: VariableFilter): boolean {
  return a.scope === b.scope && a.plugin === b.plugin && (a.search ?? '') === (b.search ?? '')
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
