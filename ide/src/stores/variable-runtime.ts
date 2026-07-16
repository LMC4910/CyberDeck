// Variable runtime (CD-326). A mock variable stream that drives bound widgets
// event-driven (NO polling): each variable path has its own subscriber set, so a
// tick notifies exactly the widgets that depend on that path. Expressions re-evaluate
// only when one of their dependency paths changes. The gateway-backed
// VariablesRepository swaps in at M5 without changing this contract.
import type { VarResolver } from '@/shared/expr'

export class VariableRuntime {
  private readonly values = new Map<string, unknown>()
  private readonly listeners = new Map<string, Set<() => void>>()

  constructor(seed?: Record<string, unknown>) {
    if (seed) for (const [k, v] of Object.entries(seed)) this.values.set(k, v)
  }

  get(path: string): unknown {
    return this.values.get(path)
  }

  /** Emit a tick: update a path's value and notify only its subscribers. */
  tick(path: string, value: unknown): void {
    this.values.set(path, value)
    const subs = this.listeners.get(path)
    if (subs) for (const cb of subs) cb()
  }

  /** Subscribe to one path (per-path so ticks fan out precisely). */
  subscribePath(path: string, cb: () => void): () => void {
    let set = this.listeners.get(path)
    if (!set) {
      set = new Set()
      this.listeners.set(path, set)
    }
    set.add(cb)
    return () => {
      set!.delete(cb)
      if (set!.size === 0) this.listeners.delete(path)
    }
  }

  /** A VarResolver over the live values (for expression evaluation). */
  resolver: VarResolver = (path) => this.values.get(path)
}
