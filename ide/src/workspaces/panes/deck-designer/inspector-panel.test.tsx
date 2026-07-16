import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, within } from '@testing-library/react'
import { GROUP_TYPE, type WidgetInstance } from '@/shared/project'
import { renderInspector, docWith } from './test-harness'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 10, y: 20, w: 100, h: 80 }, ...over }
}

const panel = (c: HTMLElement) => c.querySelector('[data-testid="inspector-panel"]') as HTMLElement
const field = (c: HTMLElement, label: string) => {
  const row = [...c.querySelectorAll('.dd-field')].find((r) => r.textContent?.startsWith(label))
  return row?.querySelector('input, select') as HTMLInputElement
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Inspector selection modes (CD-312)', () => {
  it('empty selection → Page Properties', () => {
    const { container } = renderInspector(docWith([w('w_aaaaaa')]))
    expect(panel(container)).toHaveAttribute('data-mode', 'none')
    expect(within(panel(container)).getByLabelText('Page')).toBeInTheDocument()
    expect(field(container, 'Width')).toBeInTheDocument()
  })

  it('single widget → Layer + Transform sections', () => {
    const { container, engine } = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => engine.selectOnly('w_aaaaaa'))
    expect(panel(container)).toHaveAttribute('data-mode', 'single')
    expect(within(panel(container)).getByLabelText('Transform')).toBeInTheDocument()
    expect(field(container, 'X')).toHaveValue(10)
  })

  it('multi selection → Arrange section with align + group', () => {
    const { container, engine } = renderInspector(docWith([w('w_aaaaaa'), w('w_bbbbbb', { frame: { x: 200, y: 0, w: 40, h: 40 } })]))
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    expect(panel(container)).toHaveAttribute('data-mode', 'multi')
    expect(within(panel(container)).getByLabelText('Align')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="arrange-group"]')).toBeTruthy()
  })
})

describe('Inspector fields write through undoable commands (CD-312)', () => {
  it('editing X updates the model and undo restores it', () => {
    const { container, engine, model, undo } = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => engine.selectOnly('w_aaaaaa'))
    const x = field(container, 'X')
    fireEvent.change(x, { target: { value: '55' } })
    fireEvent.blur(x)
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(55)
    act(() => undo.undo())
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(10)
  })

  it('toggling Locked writes through the model', () => {
    const { container, engine, model } = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => engine.selectOnly('w_aaaaaa'))
    fireEvent.click(field(container, 'Locked'))
    expect(model.widget('w_aaaaaa')!.locked).toBe(true)
  })

  it('Page width edit writes to the page canvas (undoable)', () => {
    const { container, model, undo } = renderInspector(docWith([w('w_aaaaaa')]))
    const width = field(container, 'Width')
    fireEvent.change(width, { target: { value: '1440' } })
    fireEvent.blur(width)
    expect(model.page(model.pages()[0]!.id)!.canvas!.w).toBe(1440)
    act(() => undo.undo())
    expect(model.page(model.pages()[0]!.id)!.canvas!.w).toBe(1000)
  })

  it('align-left on a multi-selection moves widgets in one undo entry', () => {
    const { container, engine, model, undo } = renderInspector(
      docWith([w('w_aaaaaa', { frame: { x: 0, y: 0, w: 40, h: 40 } }), w('w_bbbbbb', { frame: { x: 200, y: 0, w: 40, h: 40 } })]),
    )
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    const alignLeft = within(panel(container)).getByLabelText('Align').querySelector('button')!
    act(() => alignLeft.click())
    expect(model.widget('w_bbbbbb')!.frame.x).toBe(0)
    const len = undo.length
    act(() => undo.undo())
    expect(model.widget('w_bbbbbb')!.frame.x).toBe(200)
    expect(len).toBe(1)
  })

  it('group button in the Arrange section dispatches the group command', () => {
    const { container, engine, model } = renderInspector(docWith([w('w_aaaaaa'), w('w_bbbbbb', { frame: { x: 200, y: 0, w: 40, h: 40 } })]))
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    act(() => (container.querySelector('[data-testid="arrange-group"]') as HTMLButtonElement).click())
    expect(model.widgetsOf(model.pages()[0]!.id).some((x) => x.type === GROUP_TYPE)).toBe(true)
  })
})
