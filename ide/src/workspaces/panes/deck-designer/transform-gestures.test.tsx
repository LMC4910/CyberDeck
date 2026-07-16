import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { type WidgetInstance } from '@/shared/project'
import { renderDeckPane, docWith } from './test-harness'

function w(id: string, x: number, y = 0): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y, w: 100, h: 80 } }
}

function setup(widgets = [w('w_aaaaaa', 0), w('w_bbbbbb', 200)]) {
  // Snapping OFF so these tests exercise the raw gesture math (CD-307 tests snap).
  return renderDeckPane(docWith(widgets, 'G'), { snap: false })
}

describe('transform gestures (CD-306)', () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
    // deterministic rAF: run synchronously
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  function drag(el: Element, from: { x: number; y: number }, to: { x: number; y: number }, opts: PointerEventInit = {}) {
    fireEvent.pointerDown(el, { clientX: from.x, clientY: from.y, ...opts })
    act(() => {
      fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, ...opts })
      fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y, ...opts })
    })
  }

  it('dragging a widget moves it and records ONE undo entry', () => {
    const { container, model, undo } = setup()
    const el = container.querySelector('[data-widget="w_aaaaaa"]')!
    drag(el, { x: 10, y: 10 }, { x: 60, y: 30 }) // Δ = (50,20)
    expect(model.widget('w_aaaaaa')!.frame).toMatchObject({ x: 50, y: 20 })
    expect(undo.length).toBe(1)
  })

  it('one gesture = one history entry; undo restores the start frame', () => {
    const { container, model, undo } = setup()
    const el = container.querySelector('[data-widget="w_aaaaaa"]')!
    drag(el, { x: 0, y: 0 }, { x: 40, y: 0 })
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(40)
    act(() => {
      undo.undo()
    })
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(0)
  })

  it('multi-drag moves every selected widget by the same delta in one entry', () => {
    const { container, model, engine, undo } = setup()
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    const el = container.querySelector('[data-widget="w_aaaaaa"]')!
    drag(el, { x: 5, y: 5 }, { x: 35, y: 25 }) // Δ = (30,20)
    expect(model.widget('w_aaaaaa')!.frame).toMatchObject({ x: 30, y: 20 })
    expect(model.widget('w_bbbbbb')!.frame).toMatchObject({ x: 230, y: 20 })
    expect(undo.length).toBe(1)
  })

  it('resize via the east handle grows width in one entry', () => {
    const { container, model, engine, undo } = setup()
    act(() => engine.selectOnly('w_aaaaaa'))
    const handle = container.querySelector('[data-handle="e"]')!
    drag(handle, { x: 100, y: 40 }, { x: 160, y: 40 }) // Δx = 60
    expect(model.widget('w_aaaaaa')!.frame.w).toBe(160)
    expect(undo.length).toBe(1)
  })

  it('rotate handle writes config.rotation (snapped) in one entry', () => {
    const { container, model, engine, undo } = setup()
    act(() => engine.selectOnly('w_aaaaaa')) // center (50,40)
    const rot = container.querySelector('[data-handle="rotate"]')!
    // drag to the right of center → ~90°
    drag(rot, { x: 50, y: 0 }, { x: 150, y: 40 })
    expect((model.widget('w_aaaaaa')!.config as { rotation: number }).rotation).toBe(90)
    expect(undo.length).toBe(1)
  })

  it('locked widgets do not move', () => {
    const { container, model } = setup([{ ...w('w_aaaaaa', 0), locked: true }])
    const el = container.querySelector('[data-widget="w_aaaaaa"]')!
    drag(el, { x: 0, y: 0 }, { x: 50, y: 0 })
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(0)
  })

  it('a click without drag does not create an undo entry', () => {
    const { container, undo } = setup()
    const el = container.querySelector('[data-widget="w_aaaaaa"]')!
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 })
    act(() => {
      fireEvent.pointerUp(window, { clientX: 10, clientY: 10 })
    })
    expect(undo.length).toBe(0)
  })
})
