import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine, CanvasViewBus } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CanvasViewProvider } from './use-canvas-view'
import { InsertPanel } from './insert-panel'
import { INSERT_DND_TYPE } from './insert-catalog'
import { renderDeckPane, docWith } from './test-harness'

function renderInsert() {
  const model = ProjectModel.empty('I')
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const bus = new CanvasViewBus()
  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <CanvasViewProvider value={bus}>
            <InsertPanel pageId={model.pages()[0]!.id} />
          </CanvasViewProvider>
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )
  return { model, engine, undo, pageId: model.pages()[0]!.id, ...view }
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('InsertPanel (CD-315)', () => {
  it('renders catalog tiles grouped by category', () => {
    const { container } = renderInsert()
    expect(container.querySelectorAll('.dd-insert-tile').length).toBeGreaterThanOrEqual(6)
    expect(container.querySelector('[aria-label="Data"]')).toBeTruthy()
  })

  it('search filters the tiles', () => {
    const { container } = renderInsert()
    fireEvent.change(container.querySelector('[aria-label="Search widgets"]')!, { target: { value: 'gauge' } })
    const tiles = [...container.querySelectorAll('.dd-insert-tile')].map((t) => t.getAttribute('data-insert'))
    expect(tiles).toEqual(['gauge.circular'])
  })

  it('double-click inserts a node, selects it, and it is undoable', () => {
    const { container, model, engine, undo, pageId } = renderInsert()
    fireEvent.doubleClick(container.querySelector('[data-insert="button.action"]')!)
    const inserted = model.widgetsOf(pageId).find((w) => w.type === 'button.action')!
    expect(inserted).toBeTruthy()
    expect(engine.state.ids).toEqual([inserted.id])
    expect(undo.length).toBe(1)
    act(() => undo.undo())
    expect(model.widgetsOf(pageId)).toHaveLength(0)
  })

  it('drag tiles carry the widget type on the drag payload', () => {
    const { container } = renderInsert()
    const setData = vi.fn()
    fireEvent.dragStart(container.querySelector('[data-insert="gauge.circular"]')!, { dataTransfer: { setData } })
    expect(setData).toHaveBeenCalledWith(INSERT_DND_TYPE, 'gauge.circular')
  })
})

describe('Insert via drag-to-canvas (CD-315)', () => {
  it('dropping a widget type on the canvas inserts a node (undoable)', () => {
    const { container, model, undo } = renderDeckPane(docWith([]))
    const pane = container.querySelector('[data-pane="deck-designer"]') as HTMLElement
    const before = model.widgetsOf(model.pages()[0]!.id).length
    const dataTransfer = { getData: (t: string) => (t === INSERT_DND_TYPE ? 'stat.readout' : ''), types: [INSERT_DND_TYPE] }
    fireEvent.drop(pane, { clientX: 100, clientY: 100, dataTransfer })
    const after = model.widgetsOf(model.pages()[0]!.id)
    expect(after.length).toBe(before + 1)
    expect(after.some((w) => w.type === 'stat.readout')).toBe(true)
    expect(undo.length).toBe(1)
  })
})
