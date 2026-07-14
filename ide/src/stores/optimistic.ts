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
  /** Called after a rollback so the caller can emit a corrective event. */
  onRollback?: (error: unknown, restored: S) => void
}

/**
 * Run an optimistic mutation. Applies `apply` at once; on `commit` success
 * optionally reconciles; on failure restores the snapshot and calls `onRollback`,
 * then rethrows so the caller still sees the error.
 */
export async function optimistic<S, T>(mutation: OptimisticMutation<S, T>): Promise<T> {
  const snapshot = mutation.store.getState()
  mutation.store.setState(mutation.apply(snapshot))
  try {
    const result = await mutation.commit()
    if (mutation.reconcile) {
      mutation.store.setState((s) => mutation.reconcile!(s, result))
    }
    return result
  } catch (error) {
    mutation.store.setState(snapshot) // roll back to before the optimistic apply
    mutation.onRollback?.(error, snapshot)
    throw error
  }
}
