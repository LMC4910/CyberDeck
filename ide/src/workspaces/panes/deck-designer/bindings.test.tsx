import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { renderInspector, docWith } from './test-harness'
import { Board } from './board'

function w(id: string): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 80, h: 60 } }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('binding model persistence (CD-324)', () => {
  it('bindings persist + restore with the document', () => {
    const model = new ProjectModel(docWith([w('w_aaaaaa')]))
    model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'system.cpu.percent' })
    const restored = ProjectModel.restore(model.serialize())
    expect(restored.bindingsOf('w_aaaaaa')!.value).toEqual({ mode: 'variable', src: 'system.cpu.percent' })
  })
})

describe('binding popover (CD-324)', () => {
  function setupInspector() {
    const view = renderInspector(docWith([w('w_aaaaaa')]))
    act(() => view.engine.selectOnly('w_aaaaaa'))
    return view
  }

  it('link icon opens the popover; picking a variable binds the prop (chip locks)', () => {
    const { container, model } = setupInspector()
    act(() => (container.querySelector('[data-testid="bindlink-value"]') as HTMLButtonElement).click())
    expect(container.querySelector('[data-testid="binding-popover"]')).toBeTruthy()
    // variable mode is default; pick CPU
    act(() => (container.querySelector('[data-var="system.cpu.percent"]') as HTMLButtonElement).click())
    expect(model.bindingsOf('w_aaaaaa')!.value).toMatchObject({ mode: 'variable', src: 'system.cpu.percent' })
    // the field now shows a locked chip
    expect(container.querySelector('[data-testid="bindchip-value"]')).toHaveTextContent('system.cpu.percent')
  })

  it('static mode binds a literal value', () => {
    const { container, model } = setupInspector()
    act(() => (container.querySelector('[data-testid="bindlink-text"]') as HTMLButtonElement).click())
    act(() => (container.querySelector('[data-testid="mode-static"]') as HTMLButtonElement).click())
    const input = container.querySelector('[aria-label="Static value"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })
    act(() => (container.querySelector('[data-testid="bind-apply"]') as HTMLButtonElement).click())
    expect(model.bindingsOf('w_aaaaaa')!.text).toMatchObject({ mode: 'static', val: { v: 42 } })
  })

  it('Esc closes the popover', () => {
    const { container } = setupInspector()
    act(() => (container.querySelector('[data-testid="bindlink-value"]') as HTMLButtonElement).click())
    expect(container.querySelector('[data-testid="binding-popover"]')).toBeTruthy()
    act(() => fireEvent.keyDown(document, { key: 'Escape' }))
    expect(container.querySelector('[data-testid="binding-popover"]')).toBeNull()
  })

  it('outside pointer-down closes the popover', () => {
    const { container } = setupInspector()
    act(() => (container.querySelector('[data-testid="bindlink-value"]') as HTMLButtonElement).click())
    act(() => fireEvent.pointerDown(document.body))
    expect(container.querySelector('[data-testid="binding-popover"]')).toBeNull()
  })

  it('moves focus into the popover (keyboard-complete)', () => {
    const { container } = setupInspector()
    act(() => (container.querySelector('[data-testid="bindlink-value"]') as HTMLButtonElement).click())
    const popover = container.querySelector('[data-testid="binding-popover"]')!
    expect(popover.contains(document.activeElement)).toBe(true)
  })

  it('unbinding removes the binding', () => {
    const { container, model } = setupInspector()
    act(() => model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'fps.current' }))
    act(() => (container.querySelector('[data-testid="unbind-value"]') as HTMLButtonElement).click())
    expect(model.bindingsOf('w_aaaaaa')?.value).toBeUndefined()
  })
})

describe('canvas bind-dot (CD-324)', () => {
  it('a bound widget shows a bind-dot on the board', () => {
    const model = new ProjectModel(docWith([w('w_aaaaaa')]))
    model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'fps.current' })
    const { container } = render(<Board model={model} pageId={model.pages()[0]!.id} />)
    expect(container.querySelector('[data-testid="bind-dot-w_aaaaaa"]')).toBeTruthy()
  })
})
