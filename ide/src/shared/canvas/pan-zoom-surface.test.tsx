import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'
import { PanZoomSurface, type PanZoomHandle } from './pan-zoom-surface'
import { screenToWorld } from './view-transform'

// jsdom returns a zero rect; give the surface a deterministic 800×600 viewport at
// the origin so anchor/centre math is exercised for real.
function stubRect(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, ...rect }) as DOMRect
}

function surface() {
  return screen.getByRole('application')
}

describe('PanZoomSurface', () => {
  beforeEach(() => {
    // jsdom lacks pointer capture.
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('renders the world layer with an identity transform initially', () => {
    render(<PanZoomSurface aria-label="Test canvas">hi</PanZoomSurface>)
    const world = surface().querySelector('.pz-world') as HTMLElement
    expect(world.style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('exposes actions + live transform via the imperative handle', () => {
    const ref = createRef<PanZoomHandle>()
    render(<PanZoomSurface ref={ref} aria-label="c" />)
    stubRect(surface(), {})
    act(() => ref.current!.actions.zoomTo(2))
    expect(ref.current!.getTransform().scale).toBe(2)
  })

  it('⌘= zooms in about the viewport centre, ⌘- zooms out, ⌘0 resets', () => {
    const ref = createRef<PanZoomHandle>()
    render(<PanZoomSurface ref={ref} aria-label="c" zoomStep={2} />)
    const el = surface()
    stubRect(el, {})
    el.focus()

    const key = (k: string) => {
      const e = new KeyboardEvent('keydown', { key: k, metaKey: true, bubbles: true, cancelable: true })
      act(() => {
        el.dispatchEvent(e)
      })
    }
    key('=')
    expect(ref.current!.getTransform().scale).toBe(2)
    // Centre (400,300) stays put after zoom.
    const t = ref.current!.getTransform()
    expect(screenToWorld(t, { x: 400, y: 300 })).toEqual({ x: 400, y: 300 })

    key('-')
    expect(ref.current!.getTransform().scale).toBe(1)

    key('0')
    // reset → actual size centred: origin at viewport centre
    expect(ref.current!.getTransform()).toEqual({ scale: 1, tx: 400, ty: 300 })
  })

  it('modifier + wheel zooms at the cursor; plain wheel pans', () => {
    const ref = createRef<PanZoomHandle>()
    render(<PanZoomSurface ref={ref} aria-label="c" />)
    const el = surface()
    stubRect(el, {})

    const wheel = (init: WheelEventInit) => {
      const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })
      act(() => {
        el.dispatchEvent(e)
      })
      return e
    }

    // Zoom in at cursor (200,150): that world point must stay pinned.
    const worldAtCursorBefore = screenToWorld(ref.current!.getTransform(), { x: 200, y: 150 })
    wheel({ deltaY: -100, ctrlKey: true, clientX: 200, clientY: 150 })
    const t = ref.current!.getTransform()
    expect(t.scale).toBeGreaterThan(1)
    const pinned = screenToWorld(t, { x: 200, y: 150 })
    expect(pinned.x).toBeCloseTo(worldAtCursorBefore.x, 6)
    expect(pinned.y).toBeCloseTo(worldAtCursorBefore.y, 6)

    // Plain wheel pans (no scale change).
    const before = ref.current!.getTransform()
    wheel({ deltaX: 30, deltaY: 40 })
    const after = ref.current!.getTransform()
    expect(after.scale).toBe(before.scale)
    expect(after.tx).toBe(before.tx - 30)
    expect(after.ty).toBe(before.ty - 40)
  })

  it('calls onChange when the transform changes', () => {
    const onChange = vi.fn()
    const ref = createRef<PanZoomHandle>()
    render(<PanZoomSurface ref={ref} aria-label="c" onChange={onChange} />)
    stubRect(surface(), {})
    act(() => ref.current!.actions.zoomTo(3))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 3 }))
  })

  it('reset fits content bounds when getFitBounds returns a rect', () => {
    const ref = createRef<PanZoomHandle>()
    render(
      <PanZoomSurface
        ref={ref}
        aria-label="c"
        getFitBounds={() => ({ x: 0, y: 0, w: 400, h: 300 })}
      />,
    )
    stubRect(surface(), {})
    act(() => ref.current!.actions.reset())
    // available 800-48 × 600-48 = 752×552; scale = min(752/400,552/300)=1.84
    const t = ref.current!.getTransform()
    expect(t.scale).toBeCloseTo(1.84, 5)
  })

  it('supports render-prop children receiving the live transform', () => {
    render(
      <PanZoomSurface aria-label="c">
        {({ transform }) => <div data-testid="scale">{transform.scale}</div>}
      </PanZoomSurface>,
    )
    expect(screen.getByTestId('scale')).toHaveTextContent('1')
  })
})
