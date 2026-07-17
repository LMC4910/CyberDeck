// Computed/expression engine (CD-403). Derived variables (scope 'computed' /
// 'expression') hold a sandboxed expression instead of a literal; their value is
// EVALUATED from other variables' live values using @/shared/expr (CD-323 — a
// no-`eval` parser/interpreter). This engine owns three jobs:
//
//   • DEPENDENCY TRACKING — each expression's variable paths are extracted with
//     `collectVars`; a tick on a path only recomputes when that path is actually a
//     dependency (a tick on an unrelated variable does nothing).
//   • RE-EVALUATION — on a dependency tick (or a definition/seed change) the derived
//     set is recomputed in topological order, so a computed var that depends on
//     another computed var sees the fresh value.
//   • CYCLE REJECTION — a → b → a is detected up front and both members resolve to a
//     `{ ok: false, error }` result carrying the cycle path, rather than looping.
//
// It is deliberately store-free and framework-free: the controller owns the store and
// installs it as the results sink, so this file is a pure unit under test.
import { collectVars, evaluate, parse, ExprError, type ExprValue } from '@/shared/expr'

/** A derived variable's identity + its expression source. */
export interface ComputedDef {
  id: string
  expr: string
}

/** The outcome of evaluating one derived variable. */
export type ComputedResult = { ok: true; value: ExprValue } | { ok: false; error: string }

/** Called with the full result map whenever anything recomputes. */
export type ComputedSink = (results: ReadonlyMap<string, ComputedResult>) => void

/** Only primitives cross into the sandbox — objects/arrays resolve to undefined. */
function coerce(v: unknown): ExprValue {
  return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined
}

export class ComputedEngine {
  private readonly defs = new Map<string, string>() // id → expression source
  private readonly deps = new Map<string, string[]>() // id → variable paths it reads
  private readonly base = new Map<string, ExprValue>() // non-derived dependency values
  /** Derived ids in a dependency cycle → the human-readable cycle message. */
  private cycles = new Map<string, string>()
  /** Evaluation order for the acyclic derived vars (dependencies first). */
  private order: string[] = []
  private current = new Map<string, ComputedResult>()
  private readonly sink?: ComputedSink

  constructor(sink?: ComputedSink) {
    this.sink = sink
  }

  /** Replace the derived-variable definitions and recompute from scratch. */
  setDefinitions(defs: ComputedDef[]): void {
    this.defs.clear()
    this.deps.clear()
    for (const d of defs) {
      this.defs.set(d.id, d.expr)
      this.deps.set(d.id, dependencyPathsOf(d.expr))
    }
    this.rebuild()
    this.recompute()
  }

  /** Seed/refresh base (non-derived) dependency values, then recompute. */
  seed(values: Record<string, unknown>): void {
    for (const [k, v] of Object.entries(values)) this.base.set(k, coerce(v))
    this.recompute()
  }

  /**
   * A variable ticked. Updates the base value and, only when the ticked path is a
   * dependency of some derived var, recomputes. Returns whether a recompute ran —
   * the "dependency-tracked" proof (an unrelated tick is a no-op).
   */
  onTick(id: string, value: unknown): boolean {
    this.base.set(id, coerce(value))
    if (!this.isDependency(id)) return false
    this.recompute()
    return true
  }

  /** Current result for a derived id (undefined until first computed). */
  resultOf(id: string): ComputedResult | undefined {
    return this.current.get(id)
  }

  /** The variable paths a derived var reads (inspector "depends on" list). */
  dependenciesOf(id: string): string[] {
    return this.deps.get(id) ?? []
  }

  /** Every non-derived path any definition depends on — the values to seed/watch. */
  dependencyPaths(): string[] {
    const out = new Set<string>()
    for (const paths of this.deps.values()) {
      for (const p of paths) if (!this.defs.has(p)) out.add(p)
    }
    return [...out]
  }

  private isDependency(id: string): boolean {
    for (const paths of this.deps.values()) if (paths.includes(id)) return true
    return false
  }

  /** Rebuild the derived-only dependency graph: topological order + cycle set. */
  private rebuild(): void {
    const ids = [...this.defs.keys()]
    const derived = new Set(ids)
    // Edges only between derived vars — a base dependency can never form a cycle.
    const adj = new Map<string, string[]>(
      ids.map((id) => [id, (this.deps.get(id) ?? []).filter((p) => derived.has(p))]),
    )
    this.cycles = detectCycles(ids, adj)
    this.order = topoOrder(ids, adj, this.cycles)
  }

  private recompute(): void {
    const next = new Map<string, ComputedResult>()
    // Cyclic members never evaluate — they carry the cycle message instead.
    for (const [id, message] of this.cycles) next.set(id, { ok: false, error: message })
    // Derived vars resolve to their freshly computed value; everything else to base.
    const resolve = (path: string): unknown => {
      const r = next.get(path)
      if (r) return r.ok ? r.value : undefined
      return this.base.get(path)
    }
    for (const id of this.order) {
      const src = this.defs.get(id)!
      try {
        next.set(id, { ok: true, value: evaluate(src, { vars: resolve }) })
      } catch (e) {
        next.set(id, { ok: false, error: e instanceof ExprError ? e.message : String(e) })
      }
    }
    this.current = next
    this.sink?.(this.current)
  }
}

/** Variable paths an expression reads; a parse error yields none (surfaces at eval). */
function dependencyPathsOf(expr: string): string[] {
  try {
    return collectVars(parse(expr))
  } catch {
    return []
  }
}

/**
 * Kahn topological sort over the acyclic derived subgraph (dependencies first), so a
 * computed var is always evaluated after the derived vars it reads. Cyclic nodes are
 * excluded — they never evaluate.
 */
function topoOrder(ids: string[], adj: Map<string, string[]>, cyclic: Map<string, string>): string[] {
  const nodes = ids.filter((id) => !cyclic.has(id))
  const set = new Set(nodes)
  const indegree = new Map<string, number>(nodes.map((id) => [id, 0]))
  const dependents = new Map<string, string[]>(nodes.map((id) => [id, []]))
  for (const id of nodes) {
    for (const dep of adj.get(id) ?? []) {
      if (!set.has(dep)) continue // edge into a cyclic node — ignore
      indegree.set(id, indegree.get(id)! + 1)
      dependents.get(dep)!.push(id)
    }
  }
  const queue = nodes.filter((id) => indegree.get(id) === 0)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const d of dependents.get(id)!) {
      indegree.set(d, indegree.get(d)! - 1)
      if (indegree.get(d) === 0) queue.push(d)
    }
  }
  return order
}

/**
 * DFS cycle detection returning every node on a cycle mapped to a readable message
 * (`Cycle detected: a → b → a`). Handles self-references (a reads a).
 */
function detectCycles(ids: string[], adj: Map<string, string[]>): Map<string, string> {
  const out = new Map<string, string>()
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>(ids.map((id) => [id, WHITE]))
  const stack: string[] = []

  const visit = (u: string): void => {
    color.set(u, GRAY)
    stack.push(u)
    for (const v of adj.get(u) ?? []) {
      if (color.get(v) === GRAY) {
        const start = stack.indexOf(v)
        const path = stack.slice(start)
        const message = `Cycle detected: ${[...path, v].join(' → ')}`
        for (const node of path) if (!out.has(node)) out.set(node, message)
      } else if (color.get(v) === WHITE) {
        visit(v)
      }
    }
    stack.pop()
    color.set(u, BLACK)
  }

  for (const id of ids) if (color.get(id) === WHITE) visit(id)
  return out
}
