import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, within } from '@testing-library/react'
import { INSTANCE_TYPE } from './component-ops'
import { type WidgetInstance, type ProjectDocument } from '@/shared/project'
import { renderDeckPane, renderLayers, renderInspector, docWith } from './test-harness'

const panel = (c: HTMLElement) => c.querySelector('[data-testid="inspector-panel"]') as HTMLElement

function w(id: string, x: number, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 60, h: 40 }, ...over }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Component UI (CD-316)', () => {
  it('⌘⌥K creates a component; the board renders an instance in place of the widgets', () => {
    const { container, engine, model } = renderDeckPane(docWith([w('w_aaaaaa', 0), w('w_bbbbbb', 100)]))
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    const surface = container.querySelector('[role="application"]')!
    act(() => fireEvent.keyDown(surface, { key: 'k', metaKey: true, altKey: true }))
    // originals removed, one instance present on the board
    expect(container.querySelector('[data-widget="w_aaaaaa"]')).toBeNull()
    expect(container.querySelector('[data-instance]')).toBeTruthy()
    expect(model.components()).toHaveLength(1)
    expect(model.widgetsOf(model.pages()[0]!.id).filter((x) => x.type === INSTANCE_TYPE)).toHaveLength(1)
  })

  it('the layers tree badges component instances', () => {
    const doc = docWith([w('w_inst01', 0, { type: INSTANCE_TYPE, component: 'cmp_test01', name: 'Card' })])
    doc.components = [{ id: 'cmp_test01', name: 'Card', widgets: [w('w_tmpl01', 0)] }]
    const { container } = renderLayers(doc)
    expect(container.querySelector('[data-testid="instance-badge-w_inst01"]')).toBeTruthy()
  })
})

function instanceDoc(): ProjectDocument {
  const doc = docWith([w('w_inst01', 0, { type: INSTANCE_TYPE, component: 'cmp_test01', name: 'Card' })])
  doc.components = [
    { id: 'cmp_test01', name: 'Card', widgets: [w('w_tmpl01', 0)], variants: [{ id: 'var_aaaaaa', name: 'A' }, { id: 'var_bbbbbb', name: 'B' }] },
  ]
  return doc
}

describe('Variant inspector (CD-317)', () => {
  it('shows a Variants section for a selected instance and swaps per-instance', () => {
    const { container, engine, model } = renderInspector(instanceDoc())
    act(() => engine.selectOnly('w_inst01'))
    const chipB = container.querySelector('[data-variant="var_bbbbbb"]') as HTMLButtonElement
    expect(chipB).toBeTruthy()
    act(() => chipB.click())
    expect(model.widget('w_inst01')!.variant).toBe('var_bbbbbb')
  })

  it('add creates a variant; delete remaps + removes it', () => {
    const { container, engine, model } = renderInspector(instanceDoc())
    act(() => engine.selectOnly('w_inst01'))
    act(() => (container.querySelector('[data-testid="variant-add"]') as HTMLButtonElement).click())
    expect(model.component('cmp_test01')!.variants).toHaveLength(3)
    // swap to A then delete it → remapped
    act(() => (container.querySelector('[data-variant="var_aaaaaa"]') as HTMLButtonElement).click())
    act(() => (container.querySelector('[data-testid="variant-delete"]') as HTMLButtonElement).click())
    expect(model.component('cmp_test01')!.variants!.some((v) => v.id === 'var_aaaaaa')).toBe(false)
    expect(model.widget('w_inst01')!.variant).not.toBe('var_aaaaaa')
  })
})

describe('Component inspector section (CD-320)', () => {
  it('shows master info + a find-instances count for a selected instance', () => {
    const { container, engine, model } = renderInspector(instanceDoc())
    act(() => engine.selectOnly('w_inst01'))
    const section = within(panel(container)).getByLabelText('Component')
    expect(section).toBeInTheDocument()
    expect(container.querySelector('[data-testid="find-instances"]')).toHaveTextContent('1 instance')
    // rename the master
    const nameRow = [...section.querySelectorAll('.dd-field')].find((r) => r.textContent?.startsWith('Name'))!
    const input = nameRow.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Card 2' } })
    fireEvent.blur(input)
    expect(model.component('cmp_test01')!.name).toBe('Card 2')
  })

  it('find-instances selects all instances; detach removes the instance', () => {
    const doc = instanceDoc()
    doc.pages[0]!.widgets.push(w('w_inst02', 300, { type: INSTANCE_TYPE, component: 'cmp_test01', name: 'Card' }))
    const { container, engine, model } = renderInspector(doc)
    act(() => engine.selectOnly('w_inst01'))
    act(() => (container.querySelector('[data-testid="find-instances"]') as HTMLButtonElement).click())
    expect(engine.state.ids.sort()).toEqual(['w_inst01', 'w_inst02'])
    // re-select one and detach it
    act(() => engine.selectOnly('w_inst01'))
    act(() => (container.querySelector('[data-testid="detach-instance"]') as HTMLButtonElement).click())
    expect(model.widget('w_inst01')).toBeUndefined()
  })

  it('exposes a nesting breadcrumb for a nested-component instance', () => {
    const doc = instanceDoc()
    // Outer component whose template instantiates the inner (cmp_test01)
    doc.components!.push({
      id: 'cmp_outer1',
      name: 'Outer',
      widgets: [{ id: 'w_nestin', type: INSTANCE_TYPE, component: 'cmp_test01', frame: { x: 0, y: 0, w: 60, h: 40 } }],
    })
    doc.pages[0]!.widgets.push(w('w_outer1', 400, { type: INSTANCE_TYPE, component: 'cmp_outer1', name: 'Outer' }))
    const { container, engine } = renderInspector(doc)
    act(() => engine.selectOnly('w_outer1'))
    expect(container.querySelector('[data-testid="nesting-crumb"]')).toHaveTextContent('Outer › Card')
  })
})
