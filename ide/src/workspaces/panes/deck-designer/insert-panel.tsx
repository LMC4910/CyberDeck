// Insert panel v1 (CD-315). Reads the mock widget manifest catalog: search + category
// sections. Double-click inserts a widget at the canvas centre; dragging a tile to the
// canvas inserts it at the drop point (handled by the pane). Inserted widgets get a
// model node (undoable), a layer row, and become the selection.
import { useMemo, useState, useSyncExternalStore } from 'react'
import { useProjectModel } from './use-project-model'
import { useSelection } from './use-selection'
import { useUndo } from './use-undo'
import { useCanvasViewBus } from './use-canvas-view'
import { visibleWorldRect } from '@/shared/canvas'
import { INSERT_CATALOG, INSERT_DND_TYPE, insertManifest, type InsertManifest } from './insert-catalog'
import { instantiateComponent } from './component-ops'
import './insert.css'

export function InsertPanel({ pageId }: { pageId: string }) {
  const model = useProjectModel()
  const engine = useSelection()
  const undo = useUndo()
  const viewBus = useCanvasViewBus()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = INSERT_CATALOG.filter((m) => !q || m.label.toLowerCase().includes(q) || m.type.includes(q))
    const byCat = new Map<string, InsertManifest[]>()
    for (const m of matches) {
      const g = byCat.get(m.category) ?? []
      g.push(m)
      byCat.set(m.category, g)
    }
    return [...byCat.entries()]
  }, [query])

  const canvasCenter = () => {
    const { transform, size } = viewBus.getView()
    if (size.w > 0) {
      const r = visibleWorldRect(transform, size)
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    const canvas = model.page(pageId)?.canvas
    return { x: (canvas?.w ?? 400) / 2, y: (canvas?.h ?? 300) / 2 }
  }

  const doInsert = (m: InsertManifest) => insertManifest({ model, undo, engine, pageId }, m, canvasCenter())

  // Component masters (CD-316) — instantiate on double-click.
  useSyncExternalStore((cb) => model.subscribe(cb), () => model.revision)
  const q = query.trim().toLowerCase()
  const components = model.components().filter((c) => !q || c.name.toLowerCase().includes(q))

  return (
    <div className="dd-insert" data-testid="insert-panel">
      <div className="dd-insert-title">Insert</div>
      <input
        className="dd-insert-search"
        type="search"
        placeholder="Search widgets"
        aria-label="Search widgets"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="dd-insert-scroll">
        {components.length > 0 && (
          <section className="dd-insert-cat" aria-label="Components">
            <h3 className="dd-insert-cat-title">Components</h3>
            <div className="dd-insert-grid">
              {components.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="dd-insert-tile dd-insert-component"
                  data-component={c.id}
                  onDoubleClick={() => instantiateComponent({ model, undo, engine, pageId }, c.id, canvasCenter())}
                  title={`${c.name} — double-click to place`}
                >
                  <span className="dd-insert-icon" aria-hidden="true">◇</span>
                  <span className="dd-insert-label">{c.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {groups.length === 0 && components.length === 0 && <p className="dd-insert-empty">No widgets match.</p>}
        {groups.map(([category, items]) => (
          <section key={category} className="dd-insert-cat" aria-label={category}>
            <h3 className="dd-insert-cat-title">{category}</h3>
            <div className="dd-insert-grid">
              {items.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  className="dd-insert-tile"
                  data-insert={m.type}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(INSERT_DND_TYPE, m.type)}
                  onDoubleClick={() => doInsert(m)}
                  title={`${m.label} — double-click or drag to canvas`}
                >
                  <span className="dd-insert-icon" aria-hidden="true">{m.icon}</span>
                  <span className="dd-insert-label">{m.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
