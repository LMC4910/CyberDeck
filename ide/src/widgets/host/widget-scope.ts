// Widget lifecycle scope (CD-420). A mounted widget registers its subscriptions
// and timers here; the host disposes the whole scope on unmount (and on retry),
// so a widget can never leak a bus subscription or interval past its lifetime.
// This is the dispose-cleanup contract the AC's leak test exercises.

export class WidgetScope {
  private readonly disposers = new Set<() => void>()
  private disposed = false

  /**
   * Register a disposer (an unsubscribe, a `clear*`, any teardown). Returns a
   * remover so a widget can release early. If the scope is already disposed the
   * disposer runs immediately (late registration must not leak).
   */
  add(dispose: () => void): () => void {
    if (this.disposed) {
      dispose()
      return () => {}
    }
    this.disposers.add(dispose)
    return () => {
      this.disposers.delete(dispose)
    }
  }

  /** Scope-owned timeout — auto-cleared on dispose. Mirrors window.setTimeout. */
  setTimeout(fn: () => void, ms: number): () => void {
    const handle = setTimeout(fn, ms)
    return this.add(() => clearTimeout(handle))
  }

  /** Scope-owned interval — auto-cleared on dispose. */
  setInterval(fn: () => void, ms: number): () => void {
    const handle = setInterval(fn, ms)
    return this.add(() => clearInterval(handle))
  }

  /** Run and clear every registered disposer. Idempotent; a throwing disposer
   * never blocks the rest (one bad teardown can't strand the others). */
  dispose(): void {
    for (const d of this.disposers) {
      try {
        d()
      } catch {
        // teardown must be crash-proof — swallow and continue.
      }
    }
    this.disposers.clear()
    this.disposed = true
  }

  get size(): number {
    return this.disposers.size
  }

  get isDisposed(): boolean {
    return this.disposed
  }
}
