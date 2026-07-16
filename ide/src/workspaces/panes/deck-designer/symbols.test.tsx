import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine, CanvasViewBus } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CanvasViewProvider } from './use-canvas-view'
import { SymbolsPanel } from './symbols-panel'
import { insertSymbol, symbolUseCount, SYMBOL_CATALOG } from './symbol-catalog'
import { Board } from './board'
import { renderLayers, docWith } from './test-harness'

function renderSymbols() {
  const model = ProjectModel.empty('S')
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const bus = new CanvasViewBus()
  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <CanvasViewProvider value={bus}>
            <SymbolsPanel pageId={model.pages()[0]!.id} />
          </CanvasViewProvider>
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )
  return { model, engine, undo, pageId: model.pages()[0]!.id, ...view }
}

const play = SYMBOL_CATALOG.find((s) => s.id === 'sym_play00')!

beforeEach(() => {
  localStorage.clear()
})

describe('Symbols (CD-322)', () => {
  it('groups symbols by type and renders tiles', () => {
    const { container } = renderSymbols()
    expect(container.querySelector('[aria-label="icon"]')).toBeTruthy()
    expect(container.querySelector('[aria-label="lottie"]')).toBeTruthy()
    expect(container.querySelectorAll('.dd-symbol-tile').length).toBe(SYMBOL_CATALOG.length)
  })

  it('double-click drops a symbol and increments its use-count', () => {
    const { container, model } = renderSymbols()
    expect(container.querySelector('[data-testid="use-sym_play00"]')).toBeNull()
    act(() => fireEvent.doubleClick(container.querySelector('[data-symbol="sym_play00"]')!))
    expect(symbolUseCount(model, 'sym_play00')).toBe(1)
    expect(container.querySelector('[data-testid="use-sym_play00"]')).toHaveTextContent('1')
    act(() => fireEvent.doubleClick(container.querySelector('[data-symbol="sym_play00"]')!))
    expect(symbolUseCount(model, 'sym_play00')).toBe(2)
  })

  it('favorite toggle filters to favorites', () => {
    const { container } = renderSymbols()
    const fav = container.querySelector('[data-symbol="sym_play00"] .dd-symbol-fav')!
    act(() => fireEvent.click(fav))
    act(() => fireEvent.click(container.querySelector('[aria-pressed][class="dd-chip"]') ?? container.querySelector('.dd-chip')!))
    // only the favorited symbol remains
    expect(container.querySelectorAll('.dd-symbol-tile')).toHaveLength(1)
    expect(container.querySelector('[data-symbol="sym_play00"]')).toBeTruthy()
  })

  it('a dropped symbol renders on the board and appears in layers', () => {
    const model = ProjectModel.empty('S')
    const engine = new SelectionEngine(createSelectionStore())
    const undo = new UndoStack()
    const pageId = model.pages()[0]!.id
    const id = insertSymbol({ model, engine, undo, pageId }, play, { x: 100, y: 100 })

    const { container } = render(<Board model={model} pageId={pageId} />)
    const el = container.querySelector(`[data-widget="${id}"]`)!
    expect(el.querySelector('[data-testid="widget-symbol"]')).toHaveTextContent('▶')

    // and in the layers tree
    const doc = model.serialize()
    const layers = renderLayers(doc)
    void docWith
    expect(layers.container.querySelector(`[data-layer="${id}"]`)).toBeTruthy()
  })
})
