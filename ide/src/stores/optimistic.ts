// Optimistic updates + rollback (CD-133). Applies a mutation to a store
// immediately, sends the real write through the repo, and on failure rolls the
// store back to the pre-mutation snapshot and fires a corrective callback (which
// the wiring layer turns into a NotificationReceived / corrective bus event).
import type { Store } from './store-base'

export interface OptimisticMutation<S, T> {
  store: Store<S>
  /** The optimistic change applied to the store immediately. */
  apply: (state: S) => S
  /** The real write (repo call). Its resolved value is returned. */
  commit: () => Promise<T>
  /**
   * Reconcile the store with the server's authoritative result on success.
   * Omit to keep the optimistic state.
   */
  reconcile?: (state: S, result: T) => S
  /** Called after a failed commit so the caller can emit a corrective event.
   *  `restored` is the state left in the store: the pre-mutation snapshot when a
   *  clean rollback was possible, or the current (interleaved) state when another
   *  change landed mid-commit and rolling back would have clobbered it. */
  onRollback?: (error: unknown, restored: S) => void
}

/**
 * Run an optimistic mutation. Applies `apply` at once; on `commit` success
 * optionally reconciles; on failure restores the snapshot and calls `onRollback`,
 * then rethrows so the caller still sees the error.
 */
export async function optimistic<S, T>(mutation: OptimisticMutation<S, T>): Promise<T> {
  const snapshot = mutation.store.getState()
  const applied = mutation.apply(snapshot)
  mutation.store.setState(applied)
  try {
    const result = await mutation.commit()
    if (mutation.reconcile) {
      mutation.store.setState((s) => mutation.reconcile!(s, result))
    }
    return result
  } catch (error) {
    // Roll back to the pre-mutation snapshot ONLY if nothing else touched the
    // store while the commit was in flight — otherwise restoring the snapshot
    // would clobber the interleaved change. In that case we leave the state as
    // is and let the corrective callback (bus event → refetch) reconcile.
    const current = mutation.store.getState()
    const restored = current === applied ? snapshot : current
    if (current === applied) mutation.store.setState(snapshot)
    mutation.onRollback?.(error, restored)
    throw error
  }
}
