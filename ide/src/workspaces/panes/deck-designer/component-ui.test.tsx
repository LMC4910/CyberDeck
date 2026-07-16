import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { INSTANCE_TYPE } from './component-ops'
import { type WidgetInstance } from '@/shared/project'
import { renderDeckPane, renderLayers, docWith } from './test-harness'

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
