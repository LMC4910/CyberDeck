import { describe, expect, it, vi } from 'vitest'
import { act, useState } from 'react'
import { renderWithProviders } from '@/shared/test'
import { WorkspaceService } from '@/services/workspace'
import { WorkspaceRail, PaneHost, WORKSPACE_CONTRIBUTIONS } from '@/workspaces'

function makeService(onChanged?: (id: string) => void) {
  const svc = new WorkspaceService({ onChanged })
  svc.registerAll(WORKSPACE_CONTRIBUTIONS)
  return svc
}

describe('WORKSPACE_CONTRIBUTIONS', () => {
  it('declares 7 workspaces, each with a distinct dynamic-import loader', () => {
    expect(WORKSPACE_CONTRIBUTIONS).toHaveLength(7)
    const loaders = new Set(WORKSPACE_CONTRIBUTIONS.map((w) => w.lazyPane))
    expect(loaders.size).toBe(7) // distinct loaders → distinct chunks
    for (const w of WORKSPACE_CONTRIBUTIONS) expect(typeof w.lazyPane).toBe('function')
  })

  it('rails the 7 in contiguous order — Runtime is the seventh (no Home)', () => {
    expect(makeService().list().map((w) => w.id)).toEqual([
      'deck-designer',
      'flows',
      'variables',
      'library',
      'devices',
      'projects',
      'runtime',
    ])
    expect(WORKSPACE_CONTRIBUTIONS.map((w) => w.order).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('an unrestored first boot lands on Projects (first registered wins)', () => {
    expect(makeService().active()).toBe('projects')
  })
})

describe('WorkspaceRail — keyboard + routing', () => {
  it('renders a tab per workspace with roving tabindex', () => {
    const svc = makeService()
    const { getAllByRole } = renderWithProviders(<WorkspaceRail service={svc} active="runtime" />)
    const tabs = getAllByRole('tab')
    expect(tabs).toHaveLength(7)
    // exactly one tab is in the tab order (roving tabindex)
    const inOrder = tabs.filter((t) => t.getAttribute('tabindex') === '0')
    expect(inOrder).toHaveLength(1)
    expect(getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')).toHaveAttribute(
      'data-workspace',
      'runtime',
    )
  })

  it('ArrowDown moves roving focus; clicking switches + fires WorkspaceChanged', () => {
    const onChanged = vi.fn()
    const svc = makeService(onChanged)
    const { getAllByRole, getByLabelText } = renderWithProviders(
      <WorkspaceRail service={svc} active="deck-designer" />,
    )
    const first = getAllByRole('tab')[0]!
    act(() => first.focus())
    act(() => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    // focus moved to the second workspace (Flows)
    expect(document.activeElement).toBe(getByLabelText('Flows'))

    act(() => getByLabelText('Runtime').click())
    expect(svc.active()).toBe('runtime')
    expect(onChanged).toHaveBeenCalledWith('runtime')
  })
})

describe('PaneHost — lazy pane mount', () => {
  it('lazy-loads and renders the active workspace pane', async () => {
    const svc = makeService()
    const { findByLabelText } = renderWithProviders(<PaneHost service={svc} active="runtime" />)
    expect(await findByLabelText('Runtime workspace')).toBeInTheDocument()
  })

  it('switches to another lazily-loaded pane', async () => {
    function Harness() {
      const [active, setActive] = useState('runtime')
      const svc = makeService()
      svc.setActive(active)
      return (
        <div>
          <button onClick={() => setActive('library')}>go library</button>
          <PaneHost service={svc} active={active} />
        </div>
      )
    }
    const { getByText, findByText, findByLabelText } = renderWithProviders(<Harness />)
    expect(await findByLabelText('Runtime workspace')).toBeInTheDocument()
    act(() => getByText('go library').click())
    expect(await findByText('Library')).toBeInTheDocument()
  })
})
