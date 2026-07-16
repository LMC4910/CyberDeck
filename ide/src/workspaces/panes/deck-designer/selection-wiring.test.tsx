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

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 50, h: 50 } }
}

function setup() {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'Sel' },
    pages: [{ id: 'page_seltst', name: 'P', canvas: { w: 800, h: 600 }, widgets: [w('w_aaaaaa', 0), w('w_bbbbbb', 100), w('w_cccccc', 200)] }],
  })
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const canvasSettings = createStore({ snap: false, grid: 8 }, { name: 'canvas', kind: 'temp' })
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
  return { model, engine, undo, ...view }
}

const rings = (c: HTMLElement) => c.querySelectorAll('.dd-widget-ring').length
const ringOn = (c: HTMLElement, id: string) => !!c.querySelector(`[data-widget="${id}"] .dd-widget-ring`)

describe('canvas selection wiring (CD-305)', () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('renders no ring initially', () => {
    const { container } = setup()
    expect(rings(container)).toBe(0)
  })

  it('clicking a widget selects it and shows the ring (store → ring)', () => {
    const { container, engine } = setup()
    fireEvent.pointerDown(container.querySelector('[data-widget="w_bbbbbb"]')!)
    expect(engine.state.ids).toEqual(['w_bbbbbb'])
    expect(ringOn(container, 'w_bbbbbb')).toBe(true)
    expect(rings(container)).toBe(1)
  })

  it('the SAME store drives the ring from a non-DOM engine call (one source, no fan-out)', () => {
    const { container, engine } = setup()
    act(() => engine.selectMany(['w_aaaaaa', 'w_cccccc']))
    expect(ringOn(container, 'w_aaaaaa')).toBe(true)
    expect(ringOn(container, 'w_cccccc')).toBe(true)
    expect(rings(container)).toBe(2)
    act(() => engine.clear())
    expect(rings(container)).toBe(0)
  })

  it('⇧-click extends a range through the ordered widget list', () => {
    const { container, engine } = setup()
    fireEvent.pointerDown(container.querySelector('[data-widget="w_aaaaaa"]')!)
    fireEvent.pointerDown(container.querySelector('[data-widget="w_cccccc"]')!, { shiftKey: true })
    expect(engine.state.ids).toEqual(['w_aaaaaa', 'w_bbbbbb', 'w_cccccc'])
    expect(rings(container)).toBe(3)
  })

  it('⌘-click toggles a widget in/out of the selection', () => {
    const { container, engine } = setup()
    fireEvent.pointerDown(container.querySelector('[data-widget="w_aaaaaa"]')!)
    fireEvent.pointerDown(container.querySelector('[data-widget="w_bbbbbb"]')!, { metaKey: true })
    expect(engine.state.ids).toEqual(['w_aaaaaa', 'w_bbbbbb'])
    fireEvent.pointerDown(container.querySelector('[data-widget="w_aaaaaa"]')!, { metaKey: true })
    expect(engine.state.ids).toEqual(['w_bbbbbb'])
  })

  it('Tab / ⇧Tab cycle and Esc clears via the canvas keyboard handler', () => {
    const { container, engine } = setup()
    const surface = container.querySelector('[role="application"]')!
    fireEvent.keyDown(surface, { key: 'Tab' })
    expect(engine.state.ids).toEqual(['w_aaaaaa'])
    fireEvent.keyDown(surface, { key: 'Tab' })
    expect(engine.state.ids).toEqual(['w_bbbbbb'])
    fireEvent.keyDown(surface, { key: 'Tab', shiftKey: true })
    expect(engine.state.ids).toEqual(['w_aaaaaa'])
    fireEvent.keyDown(surface, { key: 'Escape' })
    expect(engine.state.ids).toEqual([])
  })

  it('⌘/Ctrl+A selects every widget; [ and ] walk selection history', () => {
    const { container, engine } = setup()
    const surface = container.querySelector('[role="application"]')!
    fireEvent.keyDown(surface, { key: 'a', ctrlKey: true })
    expect(engine.state.ids).toHaveLength(3)
    // A full click (down+up, no drag) on an already-selected widget reduces to it.
    const bbb = container.querySelector('[data-widget="w_bbbbbb"]')!
    fireEvent.pointerDown(bbb, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(window, { clientX: 10, clientY: 10 })
    expect(engine.state.ids).toEqual(['w_bbbbbb'])
    fireEvent.keyDown(surface, { key: '[' }) // history back → select-all
    expect(engine.state.ids).toHaveLength(3)
    fireEvent.keyDown(surface, { key: ']' }) // forward → single
    expect(engine.state.ids).toEqual(['w_bbbbbb'])
  })
})
