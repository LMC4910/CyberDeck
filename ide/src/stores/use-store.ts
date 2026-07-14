// React binding for stores (CD-130). useStore selects a slice with memoization so
// a component re-renders only when its selected value changes (not on unrelated
// store updates) — via useSyncExternalStore with a cached snapshot.
import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Store } from './store-base'

export function useStore<S, T>(
  store: Store<S>,
  selector: (state: S) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  // Cache the last selected value so getSnapshot returns a referentially stable
  // result while the slice is unchanged (required by useSyncExternalStore).
  const last = useRef<{ value: T } | null>(null)

  const getSnapshot = useCallback((): T => {
    const next = selector(store.getState())
    if (last.current && isEqual(last.current.value, next)) {
      return last.current.value
    }
    last.current = { value: next }
    return next
  }, [store, selector, isEqual])

  return useSyncExternalStore(
    useCallback((onChange) => store.subscribe(onChange), [store]),
    getSnapshot,
    getSnapshot,
  )
}
