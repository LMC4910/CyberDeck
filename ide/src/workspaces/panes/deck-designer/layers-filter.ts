// Layers filtering + nesting breadcrumb (CD-311). Pure helpers over the flattened
// rows and the model so the panel stays declarative.
import type { ProjectModel } from '@/shared/project'
import type { LayerRow } from './layers-model'

export type LayerFilter = 'all' | 'containers' | 'visible' | 'locked'

export const LAYER_FILTERS: { id: LayerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'containers', label: 'Containers' },
  { id: 'visible', label: 'Visible' },
  { id: 'locked', label: 'Locked' },
]

export function filterRows(rows: LayerRow[], filter: LayerFilter, query: string): LayerRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((r) => {
    if (filter === 'containers' && !r.container) return false
    if (filter === 'visible' && r.hidden) return false
    if (filter === 'locked' && !r.locked) return false
    if (q && !r.name.toLowerCase().includes(q)) return false
    return true
  })
}

export interface Crumb {
  id: string
  name: string
}

/** Ancestor chain of `id` (outermost → the node itself), for the nesting breadcrumb. */
export function ancestorsOf(model: ProjectModel, id: string): Crumb[] {
  const chain: Crumb[] = []
  let cur: string | undefined = id
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    const w = model.widget(cur)
    if (!w) break
    chain.unshift({ id: cur, name: w.name ?? w.type })
    cur = model.parentOf(cur)
  }
  return chain
}
