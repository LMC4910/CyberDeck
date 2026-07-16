import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { GROUP_TYPE, type WidgetInstance } from '@/shared/project'
import { renderLayers, docWith } from './test-harness'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 40, h: 40 }, ...over }
}

const rowEl = (c: HTMLElement, id: string) => c.querySelector(`[data-layer="${id}"]`) as HTMLElement
const treeitems = (c: HTMLElement) => c.querySelectorAll('[role="treeitem"]')

function nestedDoc() {
  const doc = docWith([
    w('w_gauge0', { name: 'CPU' }),
    w('w_stat00', { name: 'FPS', locked: true }),
    w('w_hidde0', { name: 'Muted', config: { hidden: true } }),
  ])
  doc.pages[0]!.widgets.push(w('w_group0', { name: 'Panel', type: GROUP_TYPE, config: { childIds: ['w_gauge0'] } }))
  return doc
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Layers filters + search (CD-311)', () => {
  it('filter chips narrow the list', () => {
    const { container } = renderLayers(nestedDoc())
    fireEvent.click(container.querySelector('[data-testid="filter-locked"]')!)
    const ids = [...treeitems(container)].map((el) => el.getAttribute('data-layer'))
    expect(ids).toEqual(['w_stat00'])
  })

  it('the Visible filter hides hidden layers', () => {
    const { container } = renderLayers(nestedDoc())
    fireEvent.click(container.querySelector('[data-testid="filter-visible"]')!)
    expect(rowEl(container, 'w_hidde0')).toBeNull()
  })

  it('search filters by name', () => {
    const { container } = renderLayers(nestedDoc())
    fireEvent.change(container.querySelector('[aria-label="Search layers"]')!, { target: { value: 'cpu' } })
    const ids = [...treeitems(container)].map((el) => el.getAttribute('data-layer'))
    expect(ids).toEqual(['w_gauge0'])
  })

  it('collapse-all hides children; expand-all restores them', () => {
    const { container } = renderLayers(nestedDoc())
    expect(rowEl(container, 'w_gauge0')).toBeTruthy() // child visible initially
    fireEvent.click(container.querySelector('[aria-label="Collapse all"]')!)
    expect(rowEl(container, 'w_gauge0')).toBeNull()
    fireEvent.click(container.querySelector('[aria-label="Expand all"]')!)
    expect(rowEl(container, 'w_gauge0')).toBeTruthy()
  })

  it('shows a clickable nesting breadcrumb for a nested selection', () => {
    const { container, engine } = renderLayers(nestedDoc())
    act(() => engine.selectOnly('w_gauge0'))
    // breadcrumb Panel › CPU
    expect(container.querySelector('[data-testid="crumb-w_group0"]')).toBeTruthy()
    fireEvent.click(container.querySelector('[data-testid="crumb-w_group0"]')!)
    expect(engine.state.ids).toEqual(['w_group0'])
  })
})

describe('Layers tree a11y (CD-311)', () => {
  it('is axe-clean', async () => {
    const { container } = renderLayers(nestedDoc())
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('containers expose aria-expanded; rows carry aria-level', () => {
    const { container } = renderLayers(nestedDoc())
    expect(rowEl(container, 'w_group0')).toHaveAttribute('aria-expanded', 'true')
    expect(rowEl(container, 'w_gauge0')).toHaveAttribute('aria-level', '2')
  })

  it('roving tabindex: exactly one treeitem is tabbable', () => {
    const { container } = renderLayers(nestedDoc())
    const tabbable = [...treeitems(container)].filter((el) => el.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })

  it('arrow keys move focus + selection through the tree', () => {
    const { container, engine } = renderLayers(nestedDoc())
    const tree = container.querySelector('[role="tree"]')!
    fireEvent.keyDown(tree, { key: 'Home' }) // first row
    const row0 = engine.state.ids[0]
    expect(row0).toBe(treeitems(container)[0]!.getAttribute('data-layer'))
    fireEvent.keyDown(tree, { key: 'ArrowDown' })
    expect(engine.state.ids[0]).not.toBe(row0) // moved down
    fireEvent.keyDown(tree, { key: 'ArrowUp' })
    expect(engine.state.ids[0]).toBe(row0) // back up
  })

  it('type-ahead jumps to the next row whose name matches', () => {
    const { container, engine } = renderLayers(nestedDoc())
    const tree = container.querySelector('[role="tree"]')!
    fireEvent.keyDown(tree, { key: 'Home' })
    fireEvent.keyDown(tree, { key: 'm' }) // "Muted"
    expect(engine.state.ids).toEqual(['w_hidde0'])
  })
})
