import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { type WidgetInstance } from '@/shared/project'
import { evaluate } from '@/shared/expr'
import { renderInspector, docWith } from './test-harness'
import { catalogResolver } from './variables-catalog'

function w(id: string): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 80, h: 60 } }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

function openExpr() {
  const view = renderInspector(docWith([w('w_aaaaaa')]))
  act(() => view.engine.selectOnly('w_aaaaaa'))
  act(() => (view.container.querySelector('[data-testid="bindlink-value"]') as HTMLButtonElement).click())
  act(() => (view.container.querySelector('[data-testid="mode-expression"]') as HTMLButtonElement).click())
  const ta = view.container.querySelector('[aria-label="Expression"]') as HTMLTextAreaElement
  return { ...view, ta }
}

describe('Expression editor + live preview (CD-325)', () => {
  it('live preview matches the sandbox result', () => {
    const { container, ta } = openExpr()
    fireEvent.change(ta, { target: { value: 'fps.current / 2 + 10' } })
    const expected = String(evaluate('fps.current / 2 + 10', { vars: catalogResolver }))
    expect(container.querySelector('[data-testid="expr-preview"]')).toHaveTextContent(`= ${expected}`)
  })

  it('unknown variables render a friendly error (not raw)', () => {
    const { container, ta } = openExpr()
    fireEvent.change(ta, { target: { value: 'fps.current + bogus.metric' } })
    const err = container.querySelector('[data-testid="expr-error"]')!
    expect(err).toHaveTextContent("Unknown variable 'bogus.metric'")
    expect(container.querySelector('[data-testid="expr-preview"]')).toBeNull()
    // Apply is disabled while there is an error
    expect(container.querySelector('[data-testid="bind-apply-expr"]')).toBeDisabled()
  })

  it('runtime errors (e.g. division by zero) render friendly, not a preview value', () => {
    const { container, ta } = openExpr()
    fireEvent.change(ta, { target: { value: 'fps.current / 0' } })
    expect(container.querySelector('[data-testid="expr-error"]')).toHaveTextContent(/division by zero/)
    expect(container.querySelector('[data-testid="expr-preview"]')).toBeNull()
  })

  it('variable-insert chips insert the path into the expression', () => {
    const { container, ta } = openExpr()
    const chip = container.querySelector('[data-var-chip="system.cpu.percent"]') as HTMLButtonElement
    act(() => chip.click())
    expect(ta.value).toContain('system.cpu.percent')
  })

  it('applying an expression binding stores it in the document', () => {
    const { container, ta, model } = openExpr()
    fireEvent.change(ta, { target: { value: 'fps.current > 60' } })
    act(() => (container.querySelector('[data-testid="bind-apply-expr"]') as HTMLButtonElement).click())
    expect(model.bindingsOf('w_aaaaaa')!.value).toMatchObject({ mode: 'expression', expr: 'fps.current > 60' })
  })
})
