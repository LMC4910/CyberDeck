import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { renderInspector, docWith } from './test-harness'

function w(id: string): WidgetInstance {
  return { id, type: 'button.action', frame: { x: 0, y: 0, w: 80, h: 60 } }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

const eventRow = (c: HTMLElement, g: string) => c.querySelector(`[data-gesture="${g}"]`) as HTMLElement

describe('events model (CD-328)', () => {
  it('event→flow wiring persists + restores with the document', () => {
    const model = new ProjectModel(docWith([w('w_aaaaaa')]))
    model.setEvent('w_aaaaaa', 'tap', 'flow_reset1')
    const restored = ProjectModel.restore(model.serialize())
    expect(restored.eventsOf('w_aaaaaa')).toEqual({ tap: 'flow_reset1' })
  })
})

describe('events inspector + flow drawer (CD-328)', () => {
  function setup() {
    const view = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => view.engine.selectOnly('w_aaaaaa'))
    return view
  }

  it('has a row per gesture (tap/hold/double-tap/value-change)', () => {
    const { container } = setup()
    for (const g of ['tap', 'hold', 'doubletap', 'valuechange']) {
      expect(eventRow(container, g)).toBeTruthy()
    }
  })

  it('assigning a flow wires the event and shows the trigger→action preview', () => {
    const { container, model } = setup()
    const select = eventRow(container, 'tap').querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'flow_reset1' } })
    expect(model.eventsOf('w_aaaaaa')).toEqual({ tap: 'flow_reset1' })
    expect(container.querySelector('[data-testid="flow-tap"]')).toHaveTextContent('tap → deck.reset')
    // "open in Flows" is present but disabled (workspace lands at M4)
    expect(container.querySelector('[data-testid="open-flows-tap"]')).toBeDisabled()
  })

  it('disconnecting removes the wiring (undoable)', () => {
    const { container, model, undo } = setup()
    act(() => model.setEvent('w_aaaaaa', 'hold', 'flow_boost1'))
    act(() => (container.querySelector('[data-testid="disconnect-hold"]') as HTMLButtonElement).click())
    expect(model.eventsOf('w_aaaaaa')?.hold).toBeUndefined()
    act(() => undo.undo())
    expect(model.eventsOf('w_aaaaaa')?.hold).toBe('flow_boost1')
  })
})
