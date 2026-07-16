// SelectionEngine (CD-305). All selection gestures funnel through here and land in
// the one selection store. Click/⇧/⌘, marquee (rect), lasso (polygon), Tab/⇧Tab
// cycle, Esc clear, and selection history ([ / ]) are its surface. Model-aware ops
// (marquee/lasso/cycle) take the model + page at call time so the engine holds no
// document reference (it can be created before a project is open).
import type { ProjectModel } from '@/shared/project'
import type { Store } from '../store-base'
import {
  EMPTY_SELECTION,
  type SelectionState,
} from './selection-store'
import {
  frameCenter,
  frameIntersectsRect,
  pointInPolygon,
  type Point,
  type Rect,
} from './geometry'

export interface ClickModifiers {
  shift?: boolean
  meta?: boolean // ⌘ on mac / Ctrl elsewhere
}

const HISTORY_CAP = 50

export class SelectionEngine {
  private readonly store: Store<SelectionState>
  /** Past selections (index points at the current one). */
  private history: SelectionState[] = [{ ...EMPTY_SELECTION }]
  private historyIndex = 0

  constructor(store: Store<SelectionState>) {
    this.store = store
  }

  get state(): SelectionState {
    return this.store.getState()
  }
  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener)
  }

  // ── commit + history ─────────────────────────────────────────────────────────
  private commit(next: SelectionState, { record = true } = {}): void {
    const cur = this.store.getState()
    if (sameSelection(cur, next)) return
    this.store.setState(next)
    if (record) {
      // Drop any redo tail, push, cap.
      this.history = this.history.slice(0, this.historyIndex + 1)
      this.history.push(next)
      if (this.history.length > HISTORY_CAP) this.history.shift()
      this.historyIndex = this.history.length - 1
    }
  }

  private widgetSelection(ids: string[], anchor?: string): SelectionState {
    if (ids.length === 0) return { ...EMPTY_SELECTION }
    return { kind: 'widget', ids, anchor: anchor ?? ids[ids.length - 1] }
  }

  // ── direct selection ───────────────────────────────────────────────────────────
  selectOnly(id: string): void {
    this.commit(this.widgetSelection([id], id))
  }

  selectMany(ids: string[]): void {
    this.commit(this.widgetSelection([...new Set(ids)]))
  }

  selectPage(pageId: string): void {
    this.commit({ kind: 'page', ids: [pageId] })
  }

  toggle(id: string): void {
    const cur = this.store.getState()
    const has = cur.ids.includes(id)
    const ids = has ? cur.ids.filter((x) => x !== id) : [...cur.ids, id]
    this.commit(this.widgetSelection(ids, has ? cur.anchor : id))
  }

  /** Shift-extend from the anchor to `id` along the given ordered id list. */
  extendTo(id: string, orderedIds: string[]): void {
    const cur = this.store.getState()
    const anchor = cur.anchor ?? cur.ids[0] ?? id
    const a = orderedIds.indexOf(anchor)
    const b = orderedIds.indexOf(id)
    if (a < 0 || b < 0) {
      this.selectOnly(id)
      return
    }
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    const range = orderedIds.slice(lo, hi + 1)
    this.commit({ kind: 'widget', ids: range, anchor })
  }

  /** Dispatch a click with modifiers (orderedIds enables ⇧-range). */
  click(id: string, mods: ClickModifiers = {}, orderedIds?: string[]): void {
    if (mods.shift && orderedIds) this.extendTo(id, orderedIds)
    else if (mods.shift) this.toggle(id)
    else if (mods.meta) this.toggle(id)
    else this.selectOnly(id)
  }

  clear(): void {
    this.commit({ ...EMPTY_SELECTION })
  }

  // ── model-aware selection ────────────────────────────────────────────────────
  private pageWidgetIds(model: ProjectModel, pageId: string): string[] {
    return model.widgetsOf(pageId).map((w) => w.id)
  }

  marqueeSelect(rect: Rect, model: ProjectModel, pageId: string, additive = false): void {
    const hits = model
      .widgetsOf(pageId)
      .filter((w) => frameIntersectsRect(w.frame, rect))
      .map((w) => w.id)
    const base = additive ? this.store.getState().ids : []
    this.commit(this.widgetSelection([...new Set([...base, ...hits])]))
  }

  lassoSelect(polygon: Point[], model: ProjectModel, pageId: string, additive = false): void {
    const hits = model
      .widgetsOf(pageId)
      .filter((w) => pointInPolygon(frameCenter(w.frame), polygon))
      .map((w) => w.id)
    const base = additive ? this.store.getState().ids : []
    this.commit(this.widgetSelection([...new Set([...base, ...hits])]))
  }

  selectAll(model: ProjectModel, pageId: string): void {
    this.commit(this.widgetSelection(this.pageWidgetIds(model, pageId)))
  }

  /** Tab (dir=1) / ⇧Tab (dir=-1) through the page's widgets, wrapping. */
  cycle(dir: 1 | -1, model: ProjectModel, pageId: string): void {
    const ids = this.pageWidgetIds(model, pageId)
    if (ids.length === 0) return
    const cur = this.store.getState()
    const currentIndex = cur.ids.length ? ids.indexOf(cur.ids[cur.ids.length - 1]!) : -1
    const nextIndex = (currentIndex + dir + ids.length) % ids.length
    this.selectOnly(ids[nextIndex]!)
  }

  // ── selection history ([ / ]) ──────────────────────────────────────────────────
  get canGoBack(): boolean {
    return this.historyIndex > 0
  }
  get canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1
  }
  back(): void {
    if (!this.canGoBack) return
    this.historyIndex--
    this.commit({ ...this.history[this.historyIndex]! }, { record: false })
  }
  forward(): void {
    if (!this.canGoForward) return
    this.historyIndex++
    this.commit({ ...this.history[this.historyIndex]! }, { record: false })
  }
}

function sameSelection(a: SelectionState, b: SelectionState): boolean {
  return (
    a.kind === b.kind &&
    a.ids.length === b.ids.length &&
    a.ids.every((id, i) => id === b.ids[i])
  )
}
