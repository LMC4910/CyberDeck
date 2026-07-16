// Shared test harness for the Deck Designer pane. Wires the full provider stack
// (model / selection / undo / commands / canvas-settings) the pane depends on, and
// stubs the surface bounding rect so client coords == world coords at scale 1.
import { render } from '@testing-library/react'
import { ProjectModel, type ProjectDocument } from '@/shared/project'
import { createSelectionStore, SelectionEngine, createStore } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { CommandRegistry } from '@/platform/commands'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CommandsProvider } from './use-commands'
import { CanvasSettingsProvider } from './use-canvas-settings'
import { registerCanvasCommands } from './canvas-commands'
import { LayersPanel } from './layers-panel'
import DeckDesignerPane from '../deck-designer-pane'

export interface RenderDeckOptions {
  snap?: boolean
  grid?: number
}

export function renderDeckPane(doc: ProjectDocument, opts: RenderDeckOptions = {}) {
  const model = new ProjectModel(doc)
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const commands = new CommandRegistry()
  registerCanvasCommands(commands, () => ({ model, engine, undo }))
  const canvasSettings = createStore(
    { snap: opts.snap ?? false, grid: opts.grid ?? 8 },
    { name: 'canvas', kind: 'temp' },
  )

  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <CommandsProvider value={commands}>
            <CanvasSettingsProvider value={canvasSettings}>
              <DeckDesignerPane />
            </CanvasSettingsProvider>
          </CommandsProvider>
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )

  const surface = view.container.querySelector('[role="application"]') as HTMLElement
  surface.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0 }) as DOMRect

  return { model, engine, undo, commands, canvasSettings, surface, ...view }
}

/** Render the Layers panel with the model/selection/undo providers it needs. */
export function renderLayers(doc: ProjectDocument) {
  const model = new ProjectModel(doc)
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const view = render(
    <ProjectModelProvider value={model}>
      <SelectionProvider value={engine}>
        <UndoProvider value={undo}>
          <LayersPanel pageId={doc.pages[0]!.id} />
        </UndoProvider>
      </SelectionProvider>
    </ProjectModelProvider>,
  )
  return { model, engine, undo, ...view }
}

/** Convenience: a doc with the given widgets on one page. */
export function docWith(widgets: ProjectDocument['pages'][number]['widgets'], name = 'T'): ProjectDocument {
  return {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name },
    pages: [{ id: 'page_harnss', name: 'P', canvas: { w: 1000, h: 800 }, widgets }],
  }
}
