import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { type WidgetInstance } from '@/shared/project'
import { renderDeckPane, docWith } from './test-harness'

function w(id: string, x: number, y = 0): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y, w: 100, h: 100 } }
}

function setup(snap: boolean) {
  // mover at x:0, anchor sibling at x:300 (edges 300/350/400). grid:0 isolates
  // sibling-edge snapping (grid snapping is unit-tested separately).
  return renderDeckPane(docWith([w('w_mover0', 0, 300), w('w_anchor', 300, 300)], 'Snap'), { snap, grid: 0 })
}

describe('snapping + smart guides (CD-307)', () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  it('snaps a dragged widget so its left edge aligns to a sibling edge, and shows a guide', () => {
    const { container, model } = setup(true)
    const el = container.querySelector('[data-widget="w_mover0"]')!
    // Drag mover from x:0 toward x:303 (2px past the sibling left edge 300).
    fireEvent.pointerDown(el, { clientX: 10, clientY: 310 })
    act(() => {
      fireEvent.pointerMove(window, { clientX: 313, clientY: 310 }) // Δx≈303 → left edge 303
    })
    // Snap pulls left edge 303 → 300.
    expect(model.widget('w_mover0')!.frame.x).toBe(300)
    // Guide is visible DURING the gesture.
    expect(container.querySelector('[data-testid="guide-v"]')).toBeTruthy()

    act(() => {
      fireEvent.pointerUp(window, { clientX: 313, clientY: 310 })
    })
    // Guides clear once the gesture ends.
    expect(container.querySelector('[data-testid="guide-v"]')).toBeNull()
  })

  it('⇧ held during the drag bypasses snapping (no guide, raw position)', () => {
    const { container, model } = setup(true)
    const el = container.querySelector('[data-widget="w_mover0"]')!
    // pointerdown WITHOUT shift (shift on down = select modifier); hold ⇧ on move.
    fireEvent.pointerDown(el, { clientX: 10, clientY: 310 })
    act(() => {
      fireEvent.pointerMove(window, { clientX: 313, clientY: 310, shiftKey: true })
    })
    expect(model.widget('w_mover0')!.frame.x).toBe(303) // not snapped
    expect(container.querySelector('[data-testid="guide-v"]')).toBeNull()
    act(() => fireEvent.pointerUp(window, { clientX: 313, clientY: 310, shiftKey: true }))
  })

  it('with snapping off, the widget lands at the raw position', () => {
    const { container, model } = setup(false)
    const el = container.querySelector('[data-widget="w_mover0"]')!
    fireEvent.pointerDown(el, { clientX: 10, clientY: 310 })
    act(() => {
      fireEvent.pointerMove(window, { clientX: 313, clientY: 310 })
      fireEvent.pointerUp(window, { clientX: 313, clientY: 310 })
    })
    expect(model.widget('w_mover0')!.frame.x).toBe(303)
  })
})
