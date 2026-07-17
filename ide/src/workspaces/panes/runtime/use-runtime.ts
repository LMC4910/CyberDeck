// Runtime workspace wiring (CD-407). The pane resolves its live data through two
// injection points so the feature never reaches for a repository (boundary rule):
// the shell provides the kernel's Runtime ring-buffer store + a real feed at
// assembly; absent that, each falls back to a pane-local instance of the same
// thing, so the workspace is honest and live on its own.
import { createContext, useContext, useMemo } from 'react'
import { createRuntimeStore, type RuntimeState, type Store } from '@/stores'
import { MockRuntimeFeed, type RuntimeFeed } from './runtime-feed'

const FeedContext = createContext<RuntimeFeed | null>(null)
export const RuntimeFeedProvider = FeedContext.Provider

const StoreContext = createContext<Store<RuntimeState> | null>(null)
export const RuntimeStoreProvider = StoreContext.Provider

/** The injected feed, else a pane-local mock stream (see runtime-feed.ts). */
export function useRuntimeFeed(): RuntimeFeed {
  const injected = useContext(FeedContext)
  const fallback = useMemo(() => new MockRuntimeFeed(), [])
  return injected ?? fallback
}

/**
 * The injected Runtime store (the kernel's, one of the 13), else a pane-local one
 * from the same factory — same ring buffer, same RUNTIME_CAP; it just starts empty
 * on each mount until the shell injects the kernel's instance.
 */
export function useRuntimeStore(): Store<RuntimeState> {
  const injected = useContext(StoreContext)
  const fallback = useMemo(() => createRuntimeStore(), [])
  return injected ?? fallback
}
