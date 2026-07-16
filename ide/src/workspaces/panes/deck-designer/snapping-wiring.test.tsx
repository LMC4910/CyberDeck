import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { createSelectionStore, SelectionEngine, createStore } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CanvasSettingsProvider } from './use-canvas-settings'
import DeckDesignerPane from '../deck-designer-pane'

function w(id: string, x: number, y = 0): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y, w: 100, h: 100 } }
}

function setup(snap: boolean) {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'Snap' },
    // mover at x:0, anchor sibling at x:300 (edges 300/350/400)
    pages: [{ id: 'page_snptst', name: 'P', canvas: { w: 900, h: 600 }, widgets: [w('w_mover0', 0, 300), w('w_anchor', 300, 300)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  // grid:0 isolates sibling-edge snapping (grid snapping is unit-tested separately).
  const canvasSettings = createStore({ snap, grid: 0 }, { name: 'canvas', kind: 'temp' })
  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <CanvasSettingsProvider value={canvasSettings}>
            <DeckDesignerPane />
          </CanvasSettingsProvider>
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )
  const surface = view.container.querySelector('[role="application"]') as HTMLElement
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600, x: 0, y: 0 }) as DOMRect
  return { model, engine, undo, ...view }
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
