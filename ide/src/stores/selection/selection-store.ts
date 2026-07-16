// Selection store (CD-305). The ONE selection source every panel subscribes to
// (AUDIT C2): the canvas selection ring, and later the layers tree, inspector, and
// breadcrumb all read this store — no panel keeps its own copy, no manual fan-out.
// Shape is intentionally minimal: { kind, ids, anchor }.
import { createStore, type Store } from '../store-base'

export type SelectionKind = 'none' | 'widget' | 'page'

export interface SelectionState {
  kind: SelectionKind
  /** Selected entity ids (widget ids, or a single page id when kind='page'). */
  ids: string[]
  /** Range anchor for shift-extend selection (a widget id). */
  anchor?: string
}

export const EMPTY_SELECTION: SelectionState = { kind: 'none', ids: [] }

export function createSelectionStore(): Store<SelectionState> {
  return createStore<SelectionState>({ ...EMPTY_SELECTION }, { name: 'selection', kind: 'temp' })
}

/** Coarse mode used by the inspector (none → Page Properties, single vs multi). */
export type SelectionMode = 'none' | 'page' | 'single' | 'multi'

export function selectionMode(s: SelectionState): SelectionMode {
  if (s.kind === 'none' || s.ids.length === 0) return 'none'
  if (s.kind === 'page') return 'page'
  return s.ids.length === 1 ? 'single' : 'multi'
}

export function isSelected(s: SelectionState, id: string): boolean {
  return s.ids.includes(id)
}

/** The single selected widget id, or undefined for none/multi/page. */
export function primaryWidgetId(s: SelectionState): string | undefined {
  return s.kind === 'widget' && s.ids.length === 1 ? s.ids[0] : undefined
}
