// Library workspace (CD-404). Three tabs — Components / Styles / Symbols — each reading
// the SAME registries the Insert panel and inspector use, via ./library/registry-seam
// (by reference, never a copy), so a registry change surfaces here with zero extra
// wiring. Double-click inserts a component/symbol into the open Design document; a Styles
// recolor propagates to the canvas through the CD-321 path.
//
// The seam is the single cross-feature reach into deck-designer. CD-421 re-points that
// one file at the widget-platform registry; these tabs stay unchanged.
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ComponentsTab } from './library/components-tab'
import { StylesTab } from './library/styles-tab'
import { SymbolsTab } from './library/symbols-tab'
import './library/library.css'

type TabId = 'components' | 'styles' | 'symbols'

const TABS: { id: TabId; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'styles', label: 'Styles' },
  { id: 'symbols', label: 'Symbols' },
]

export default function LibraryPane() {
  const [active, setActive] = useState<TabId>('components')
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Roving-tabindex arrow navigation across the tablist (WAI-ARIA tabs pattern).
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = TABS.findIndex((t) => t.id === active)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    const id = TABS[next]!.id
    setActive(id)
    tabRefs.current[id]?.focus()
  }

  return (
    <section className="lib-pane" data-pane="library" aria-label="Library workspace">
      <div className="lib-tabs" role="tablist" aria-label="Library registries">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-controls={`${baseId}-panel-${t.id}`}
            aria-selected={active === t.id}
            tabIndex={active === t.id ? 0 : -1}
            className="lib-tab-btn"
            onClick={() => setActive(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="lib-panel"
      >
        {active === 'components' && <ComponentsTab />}
        {active === 'styles' && <StylesTab />}
        {active === 'symbols' && <SymbolsTab />}
      </div>
    </section>
  )
}
