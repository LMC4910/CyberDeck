import { describe, expect, it } from 'vitest'
import { act, useState } from 'react'
import { renderWithProviders } from '@/shared/test'
import { DockManager } from '@/platform/dock'
import { DockHost, computeInsets } from '@/workspaces'

describe('computeInsets', () => {
  it('sums pinned docked rail sizes per side; ignores unpinned/floating', () => {
    const m = new DockManager()
    m.register({ id: 'a', defaultSide: 'left', minSize: 100, defaultSize: 200 })
    m.register({ id: 'b', defaultSide: 'right', minSize: 100, defaultSize: 250 })
    m.register({ id: 'c', defaultSide: 'right', minSize: 100, defaultSize: 150 })
    // both rails pinned → insets on both sides
    expect(computeInsets(m.list())).toEqual({ left: 200, right: 400, bottom: 0 })
    // unpin b → no longer insets
    m.unpin('b')
    expect(computeInsets(m.list())).toEqual({ left: 200, right: 150, bottom: 0 })
    // float c → no inset
    m.float('c')
    expect(computeInsets(m.list())).toEqual({ left: 200, right: 0, bottom: 0 })
  })
})

// Harness that mirrors the App wiring: DockHost re-renders on manager change.
function DockHarness() {
  const [m] = useState(() => {
    const mgr = new DockManager()
    mgr.register({ id: 'mirror', defaultSide: 'right', minSize: 200, defaultSize: 260 })
    return mgr
  })
  const [rows, setRows] = useState(m.list())
  return (
    <DockHost
      manager={m}
      content={{ mirror: <div data-mirror-body>Live Mirror</div> }}
      windows={rows}
      onChange={() => setRows(m.list())}
    />
  )
}

describe('DockHost — dock → pin → auto-hide → peek → re-pin → float journey', () => {
  it('walks the full lifecycle via header controls', () => {
    const { container } = renderWithProviders(<DockHarness />)

    // starts as a pinned rail
    expect(container.querySelector('[data-dock-rail="mirror"]')).toBeInTheDocument()

    // auto-hide (unpin) → collapses to an edge tab
    act(() => (container.querySelector('[data-dock-unpin="mirror"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-rail="mirror"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-dock-tab="mirror"]')).toBeInTheDocument()

    // peek → body appears
    act(() => (container.querySelector('[data-dock-peek="mirror"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-peekbody="mirror"]')).toBeInTheDocument()

    // re-pin (from the peek header) → back to a rail
    act(() => (container.querySelector('[data-dock-pin="mirror"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-rail="mirror"]')).toBeInTheDocument()

    // float → floating window with dock-back controls
    act(() => (container.querySelector('[data-dock-float="mirror"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-float="mirror"]')).toBeInTheDocument()

    // dock back to the left
    act(() => (container.querySelector('[data-dock-to="mirror:left"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-rail="mirror"].dock-rail-left')).toBeInTheDocument()
  })
})
