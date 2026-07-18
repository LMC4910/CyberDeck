import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodePalette } from './node-palette'
import { NODE_CATALOG, FLOW_NODE_DND_TYPE } from './flow-catalog'

describe('NodePalette (CD-410)', () => {
  it('lists every addable node kind, grouped into category sections', () => {
    render(<NodePalette onPlace={() => {}} />)
    const tiles = screen.getAllByRole('listitem')
    expect(tiles.length).toBe(NODE_CATALOG.length)
    // Category section headers present.
    expect(screen.getByRole('list')).toBeTruthy()
    expect(screen.getByText('Integrations')).toBeTruthy()
  })

  it('fuzzy search narrows the list (shared matcher)', () => {
    render(<NodePalette onPlace={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search nodes'), { target: { value: 'obs' } })
    const tiles = screen.getAllByRole('listitem')
    expect(tiles.some((t) => t.getAttribute('data-node') === 'integration.obs')).toBe(true)
    // A non-matching kind is filtered out.
    expect(tiles.some((t) => t.getAttribute('data-node') === 'action.notify')).toBe(false)
  })

  it('shows an honest empty state when nothing matches', () => {
    render(<NodePalette onPlace={() => {}} />)
    fireEvent.change(screen.getByLabelText('Search nodes'), { target: { value: 'zzzznope' } })
    expect(screen.getByText('No nodes match.')).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('double-click places the node at the graph centre', () => {
    const onPlace = vi.fn()
    render(<NodePalette onPlace={onPlace} />)
    const tile = document.querySelector('[data-node="action.command"]') as HTMLElement
    fireEvent.doubleClick(tile)
    expect(onPlace).toHaveBeenCalledWith('action.command')
  })

  it('Enter/Space on a focused tile places it (keyboard parity)', () => {
    const onPlace = vi.fn()
    render(<NodePalette onPlace={onPlace} />)
    const tile = document.querySelector('[data-node="logic.condition"]') as HTMLElement
    fireEvent.keyDown(tile, { key: 'Enter' })
    expect(onPlace).toHaveBeenCalledWith('logic.condition')
  })

  it('a tile drag carries the node kind on the flow-node DnD type', () => {
    render(<NodePalette onPlace={() => {}} />)
    const tile = document.querySelector('[data-node="data.math"]') as HTMLElement
    const store = new Map<string, string>()
    const dataTransfer = {
      setData: (t: string, v: string) => store.set(t, v),
      effectAllowed: '',
    }
    fireEvent.dragStart(tile, { dataTransfer })
    expect(store.get(FLOW_NODE_DND_TYPE)).toBe('data.math')
  })
})
