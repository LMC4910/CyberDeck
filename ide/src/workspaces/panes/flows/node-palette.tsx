// Node library palette (CD-410) — a searchable list of the addable node kinds,
// grouped by category. Mirrors the deck-designer Insert panel (CD-315): a tile is
// dragged to the graph to drop it at the cursor, or double-clicked to add it at the
// graph centre. Search is the shared fuzzy matcher (CD-206) so a query like "obs" or
// "cmd" ranks the same way the command palette does.
import { useMemo, useState } from 'react'
import { fuzzyFilter } from '@/shared/fuzzy'
import {
  NODE_CATALOG,
  PALETTE_CATEGORIES,
  CATEGORY_LABELS,
  FLOW_NODE_DND_TYPE,
  type NodeManifest,
} from './flow-catalog'
import type { NodeKind } from './flow-model'

export interface NodePaletteProps {
  /** Add `kind` at the visible-graph centre (double-click / Enter). */
  onPlace: (kind: NodeKind) => void
}

export function NodePalette({ onPlace }: NodePaletteProps) {
  const [query, setQuery] = useState('')

  // Fuzzy over "Label kind" so both the human label ("Notify") and the schema kind
  // ("action.notify") match. Grouped back into category sections, dropping empties.
  const groups = useMemo(() => {
    const scored = fuzzyFilter(query, [...NODE_CATALOG], (m) => `${m.label} ${m.kind}`)
    const ranked = scored.map((s) => s.item)
    return PALETTE_CATEGORIES.map((cat) => ({
      category: cat,
      items: ranked.filter((m) => m.category === cat),
    })).filter((g) => g.items.length > 0)
  }, [query])

  const empty = groups.length === 0

  return (
    <div className="fw-palette" data-testid="node-palette">
      <div className="fw-palette-title" id="fw-palette-title">
        Nodes
      </div>
      <input
        className="fw-palette-search"
        type="search"
        placeholder="Search nodes"
        aria-label="Search nodes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="fw-palette-scroll" role="list" aria-labelledby="fw-palette-title">
        {empty && <p className="fw-palette-empty">No nodes match.</p>}
        {groups.map(({ category, items }) => (
          <section key={category} className="fw-palette-cat" aria-label={CATEGORY_LABELS[category]}>
            <h3 className="fw-palette-cat-title">{CATEGORY_LABELS[category]}</h3>
            {items.map((m) => (
              <PaletteTile key={m.kind} manifest={m} onPlace={onPlace} />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function PaletteTile({ manifest, onPlace }: { manifest: NodeManifest; onPlace: (kind: NodeKind) => void }) {
  return (
    <button
      type="button"
      role="listitem"
      className="fw-palette-tile"
      data-node={manifest.kind}
      data-category={manifest.category}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(FLOW_NODE_DND_TYPE, manifest.kind)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDoubleClick={() => onPlace(manifest.kind)}
      // Keyboard parity with double-click: the tile is a real button, so Enter/Space
      // place the node at the graph centre.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlace(manifest.kind)
        }
      }}
      title={`${manifest.label} (${manifest.kind}) — double-click to add, or drag onto the graph`}
    >
      <span className="fw-palette-icon" aria-hidden="true">
        {manifest.icon}
      </span>
      <span className="fw-palette-label">{manifest.label}</span>
    </button>
  )
}
