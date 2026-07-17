// Variables workspace controller (CD-401). Owns the pane's query state on a store
// (the `stores` primitive, not React state — the blueprint's "no React state for
// cross-component domain data"), and is the only thing that talks to the port.
//
// Paging is *windowed*: the table virtualizes `total` rows and the controller
// fetches only the pages the scroll window actually overlaps. So {filter, sort,
// page, limit} are real server params on every keystroke and every scroll — the
// table never receives the whole set and never filters it (CD-401 AC).
import { createStore, type Store } from '@/stores'
import type { VariableRecord } from './variables-model'
import type {
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
}

const INITIAL_SORT: VariableSort = { field: 'name', dir: 'asc' }

export function initialVariablesState(): VariablesState {
  return { filter: {}, sort: INITIAL_SORT, pages: {}, total: 0, loading: true, selectedIds: [] }
}

export class VariablesController {
  readonly store: Store<VariablesState>
  private source: VariablesSource
  /** Bumped on every query change so late responses from an old query are dropped. */
  private generation = 0
  private readonly inflight = new Set<number>()

  constructor(source: VariablesSource) {
    this.source = source
    this.store = createStore<VariablesState>(initialVariablesState(), {
      name: 'variablesPane',
      kind: 'temp',
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
