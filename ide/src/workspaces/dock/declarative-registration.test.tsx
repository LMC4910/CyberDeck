// CD-216: a tool window added purely by registration (no new dock code) docks,
// pins, peeks and floats through the same DockManager + DockHost.
import { describe, expect, it } from 'vitest'
import { act, useState } from 'react'
import { renderWithProviders } from '@/shared/test'
import { DockManager } from '@/platform/dock'
import { DockHost } from '@/workspaces'

// The ONLY per-window code is a registration + a content entry — no bespoke
// component. This harness registers a brand-new "dummy" window and drives it.
function Harness() {
  const [m] = useState(() => {
    const mgr = new DockManager()
    mgr.register({ id: 'dummy', defaultSide: 'left', minSize: 150, defaultSize: 180 })
    return mgr
  })
  const [rows, setRows] = useState(m.list())
  return (
    <DockHost
      manager={m}
      content={{ dummy: <div data-dummy-body>Dummy tool</div> }}
      windows={rows}
      onChange={() => setRows(m.list())}
    />
  )
}

describe('declarative dock registration (CD-216)', () => {
  it('a registration-only window docks/pins/peeks/floats with no bespoke code', () => {
    const { container } = renderWithProviders(<Harness />)

    // renders as a pinned rail on its declared side
    expect(container.querySelector('[data-dock-rail="dummy"].dock-rail-left')).toBeInTheDocument()
    expect(container.querySelector('[data-dummy-body]')).toBeInTheDocument()

    // auto-hide → tab
    act(() => (container.querySelector('[data-dock-unpin="dummy"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-tab="dummy"]')).toBeInTheDocument()

    // peek → body
    act(() => (container.querySelector('[data-dock-peek="dummy"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-peekbody="dummy"]')).toBeInTheDocument()

    // re-pin, then float
    act(() => (container.querySelector('[data-dock-pin="dummy"]') as HTMLElement).click())
    act(() => (container.querySelector('[data-dock-float="dummy"]') as HTMLElement).click())
    expect(container.querySelector('[data-dock-float="dummy"]')).toBeInTheDocument()
  })
})
