// Layers tree flattening (CD-310). Turns the model's nesting (root widgets +
// container childIds) into a flat, depth-tagged row list honoring collapsed nodes —
// the input a virtualized list renders. Pure + cheap so it runs on every model tick.
import { isContainer, childIdsOf, type ProjectModel, type WidgetInstance } from '@/shared/project'

export interface LayerRow {
  id: string
  depth: number
  name: string
  type: string
  container: boolean
  hasChildren: boolean
  collapsed: boolean
  locked: boolean
  hidden: boolean
  color?: string
}

function cfg(w: WidgetInstance): { hidden?: boolean; colorLabel?: string } {
  return (w.config as { hidden?: boolean; colorLabel?: string } | undefined) ?? {}
}

export function flattenLayers(model: ProjectModel, pageId: string, collapsed: ReadonlySet<string>): LayerRow[] {
  const rows: LayerRow[] = []
  const walk = (id: string, depth: number) => {
    const w = model.widget(id)
    if (!w) return
    const container = isContainer(w)
    const kids = container ? childIdsOf(w) : []
    const c = cfg(w)
    rows.push({
      id,
      depth,
      name: w.name ?? w.type,
      type: w.type,
      container,
      hasChildren: kids.length > 0,
      collapsed: collapsed.has(id),
      locked: !!w.locked,
      hidden: !!c.hidden,
      color: c.colorLabel,
    })
    if (container && !collapsed.has(id)) for (const cid of kids) walk(cid, depth + 1)
  }
  for (const w of model.rootWidgets(pageId)) walk(w.id, 0)
  return rows
}
