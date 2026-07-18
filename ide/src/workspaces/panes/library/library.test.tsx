import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine, CanvasViewBus } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { MemoryStorageAdapter } from '@/services/persistence'
import { ProjectModelProvider } from '../deck-designer/use-project-model'
import { SelectionProvider } from '../deck-designer/use-selection'
import { UndoProvider } from '../deck-designer/use-undo'
import { CanvasViewProvider } from '../deck-designer/use-canvas-view'
import { INSERT_CATALOG } from '../deck-designer/insert-catalog'
import { effectiveStyleProps } from '../deck-designer/style-ops'
import LibraryPane from '../library-pane'
import { ComponentsTab } from './components-tab'
import { StylesTab } from './styles-tab'
import { SymbolsTab } from './symbols-tab'

function setup(node: ReactNode, model: ProjectModel = ProjectModel.empty('L')) {
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const bus = new CanvasViewBus()
  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <CanvasViewProvider value={bus}>{node}</CanvasViewProvider>
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )
  return { model, engine, undo, bus, pageId: model.pages()[0]!.id, ...view }
}

function modelWithFillStyle() {
  const model = ProjectModel.empty('S')
  const pageId = model.pages()[0]!.id
  model.addStyle('style_fill0', { kind: 'fill', name: 'Brand Fill', props: { color: '#112233' } })
  const wid = model.newId('widget')
  model.addWidget(pageId, { id: wid, type: 'button.action', name: 'B', frame: { x: 0, y: 0, w: 10, h: 10 } })
  return { model, pageId, wid }
}

beforeEach(() => {
  localStorage.clear()
})

describe('Library workspace shell (CD-404)', () => {
  it('renders three registry tabs, Components active first', () => {
    const { container, getByRole } = setup(<LibraryPane />)
    expect(getByRole('tab', { name: 'Components' }).getAttribute('aria-selected')).toBe('true')
    expect(getByRole('tab', { name: 'Styles' })).toBeTruthy()
    expect(getByRole('tab', { name: 'Symbols' })).toBeTruthy()
    expect(container.querySelector('[data-testid="library-components"]')).toBeTruthy()
  })

  it('arrow keys move the active tab (roving tabindex)', () => {
    const { container, getByRole } = setup(<LibraryPane />)
    fireEvent.keyDown(getByRole('tab', { name: 'Components' }), { key: 'ArrowRight' })
    expect(getByRole('tab', { name: 'Styles' }).getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-testid="library-styles"]')).toBeTruthy()
  })

  it('clicking a tab switches panels', () => {
    const { container, getByRole } = setup(<LibraryPane />)
    fireEvent.click(getByRole('tab', { name: 'Symbols' }))
    expect(container.querySelector('[data-testid="library-symbols"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="library-components"]')).toBeNull()
  })
})

describe('Components tab — single source of truth (CD-404 AC)', () => {
  it('renders every catalog entry (reads the SAME registry, by reference)', () => {
    const { container } = setup(<ComponentsTab />)
    expect(container.querySelectorAll('[data-component]').length).toBe(INSERT_CATALOG.length)
  })

  it('a NEW registry entry appears with zero extra wiring', () => {
    const type = 'test.injected'
    // Mutate the shared catalog the Insert panel also reads. No Library code changes.
    INSERT_CATALOG.push({ type, label: 'Injected Widget', category: 'Test', icon: '✚', defaultSize: { w: 10, h: 10 } })
    try {
      const { container } = setup(<ComponentsTab />)
      expect(container.querySelector(`[data-component="${type}"]`)).toBeTruthy()
      expect(container.querySelectorAll('[data-component]').length).toBe(INSERT_CATALOG.length)
    } finally {
      INSERT_CATALOG.pop()
    }
  })

  it('search filters the tiles', () => {
    const { container } = setup(<ComponentsTab />)
    fireEvent.change(container.querySelector('.lib-search')!, { target: { value: 'gauge' } })
    const tiles = [...container.querySelectorAll('[data-component]')].map((t) => t.getAttribute('data-component'))
    expect(tiles).toEqual(['gauge.circular'])
  })

  it('category chip narrows to that category', () => {
    const { container, getByRole } = setup(<ComponentsTab />)
    fireEvent.click(getByRole('button', { name: 'Media' }))
    const tiles = [...container.querySelectorAll('[data-component]')].map((t) => t.getAttribute('data-component')).sort()
    expect(tiles).toEqual(['image.static', 'media.video'])
  })

  it('favorites toggle + Favorites chip filter', () => {
    const storage = new MemoryStorageAdapter()
    const { container, getByRole } = setup(<ComponentsTab storage={storage} />)
    fireEvent.click(container.querySelector('[data-component="gauge.circular"] .lib-fav')!)
    fireEvent.click(getByRole('button', { name: /Favorites/ }))
    expect(container.querySelectorAll('[data-component]').length).toBe(1)
    expect(container.querySelector('[data-component="gauge.circular"]')).toBeTruthy()
  })

  it('hover shows a preview card', () => {
    const { container } = setup(<ComponentsTab />)
    fireEvent.mouseEnter(container.querySelector('[data-component="gauge.circular"]')!)
    expect(container.querySelector('[data-testid="lib-preview"]')).toHaveTextContent('Circular Gauge')
  })

  it('double-click inserts the widget, selects it, and is undoable', () => {
    const { container, model, engine, undo, pageId } = setup(<ComponentsTab />)
    fireEvent.doubleClick(container.querySelector('[data-component="button.action"]')!)
    const w = model.widgetsOf(pageId).find((x) => x.type === 'button.action')!
    expect(w).toBeTruthy()
    expect(engine.state.ids).toEqual([w.id])
    expect(undo.length).toBe(1)
    act(() => undo.undo())
    expect(model.widgetsOf(pageId)).toHaveLength(0)
  })
})

describe('Styles tab — recolor propagation (CD-321 path, CD-404 AC)', () => {
  it('lists shared styles from the live registry', () => {
    const { model } = modelWithFillStyle()
    const { container } = setup(<StylesTab />, model)
    expect(container.querySelector('[data-style="style_fill0"]')).toBeTruthy()
  })

  it('recolor from the Library propagates to a linked widget and is undoable', () => {
    const { model, wid } = modelWithFillStyle()
    model.linkStyle(wid, 'fill', 'style_fill0')
    const { container, undo } = setup(<StylesTab />, model)
    fireEvent.mouseEnter(container.querySelector('[data-style="style_fill0"]')!)
    act(() => fireEvent.change(container.querySelector('[data-testid="lib-recolor"]')!, { target: { value: '#ff0000' } }))
    expect(effectiveStyleProps(model, model.widget(wid)!, 'fill').color).toBe('#ff0000')
    act(() => undo.undo())
    expect(effectiveStyleProps(model, model.widget(wid)!, 'fill').color).toBe('#112233')
  })

  it('double-click applies (links) the style to the selected widget', () => {
    const { model, wid } = modelWithFillStyle()
    const { container, engine, undo } = setup(<StylesTab />, model)
    act(() => engine.selectOnly(wid))
    fireEvent.doubleClick(container.querySelector('[data-style="style_fill0"]')!)
    expect(effectiveStyleProps(model, model.widget(wid)!, 'fill').color).toBe('#112233')
    expect(undo.length).toBe(1)
  })
})

describe('Symbols tab (CD-404)', () => {
  it('double-click drops a symbol and shows a live use-count badge', () => {
    const { container, model, pageId } = setup(<SymbolsTab />)
    fireEvent.doubleClick(container.querySelector('[data-symbol="sym_play00"]')!)
    const dropped = model.widgetsOf(pageId).some((w) => (w.config as { symbol?: string } | undefined)?.symbol === 'sym_play00')
    expect(dropped).toBe(true)
    expect(container.querySelector('[data-testid="use-sym_play00"]')).toHaveTextContent('1')
  })
})
