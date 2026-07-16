// Selection React binding (CD-305). Provides the kernel's single SelectionEngine to
// every panel and a subscribed-state hook. The canvas ring, layers tree, inspector,
// and breadcrumb all read the same store through these — no panel keeps its own copy.
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { SelectionEngine, SelectionState } from '@/stores'

const SelectionContext = createContext<SelectionEngine | null>(null)
export const SelectionProvider = SelectionContext.Provider

export function useSelection(): SelectionEngine {
  const engine = useContext(SelectionContext)
  if (!engine) throw new Error('useSelection must be used within a SelectionProvider')
  return engine
}

/** Subscribe to the live selection state (re-renders on any selection change). */
export function useSelectionState(): SelectionState {
  const engine = useSelection()
  const subscribe = useCallback((cb: () => void) => engine.subscribe(cb), [engine])
  return useSyncExternalStore(subscribe, () => engine.state)
}
