// Dependency resolution (CD-419). Orders manifests dependency-first, and detects
// the two failure modes the loader must reject gracefully: a dependency on a widget
// that isn't present (missing) and a dependency cycle. A manifest that (transitively)
// depends on an unresolvable manifest is itself unresolvable and reported, so the
// loader never registers a widget whose graph can't be satisfied.
import type { WidgetManifest } from './types'

export interface ResolveResult {
  /** Resolvable ids in dependency-first order (deps before dependents). */
  order: string[]
  /** Manifests excluded because a declared widget dependency is absent. */
  missing: Array<{ id: string; missing: string[] }>
  /** Detected dependency cycles (each a list of ids forming the loop). */
  cycles: string[][]
  /** Ids excluded for any reason (missing dep, in/behind a cycle). */
  unresolved: string[]
}

function depsOf(manifest: WidgetManifest): string[] {
  return manifest.dependencies?.widgets ?? []
}

export function resolveDependencies(manifests: WidgetManifest[]): ResolveResult {
  const byId = new Map<string, WidgetManifest>()
  for (const m of manifests) byId.set(m.id, m)

  const order: string[] = []
  const missing: Array<{ id: string; missing: string[] }> = []
  const cycles: string[][] = []
  const seenCycle = new Set<string>()
  // 'ok' | 'bad' resolved; otherwise on the active DFS stack (index) or unvisited.
  const status = new Map<string, 'ok' | 'bad'>()
  const stack: string[] = []
  const onStack = new Set<string>()

  const recordMissing = (id: string, absent: string[]) => {
    if (!missing.some((m) => m.id === id)) missing.push({ id, missing: absent })
  }

  const dfs = (id: string): 'ok' | 'bad' => {
    const known = status.get(id)
    if (known) return known
    if (onStack.has(id)) {
      // Back-edge: extract the cycle slice from the active stack.
      const cycle = stack.slice(stack.indexOf(id))
      const key = [...cycle].sort().join('|')
      if (!seenCycle.has(key)) {
        seenCycle.add(key)
        cycles.push(cycle)
      }
      return 'bad'
    }

    stack.push(id)
    onStack.add(id)
    let bad = false
    const absent: string[] = []
    for (const dep of depsOf(byId.get(id)!)) {
      if (!byId.has(dep)) {
        absent.push(dep)
        bad = true
      } else if (dfs(dep) === 'bad') {
        bad = true
      }
    }
    if (absent.length) recordMissing(id, absent)

    stack.pop()
    onStack.delete(id)
    const result: 'ok' | 'bad' = bad ? 'bad' : 'ok'
    status.set(id, result)
    if (result === 'ok') order.push(id) // post-order ⇒ dependency-first
    return result
  }

  for (const m of manifests) dfs(m.id)

  const unresolved = manifests.map((m) => m.id).filter((id) => status.get(id) === 'bad')
  return { order, missing, cycles, unresolved }
}
