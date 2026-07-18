// Density (CD-424). Beginner/Power authoring complexity, persisted through
// services/configuration (never a store, never hardcoded). The one AC that matters:
// hidden content is ALWAYS signposted — Beginner trades the pro Inspector sections
// for an "Advanced (n bindings)" stub with a switch-to-Power action, and Layers
// carries a matching hint. Nothing ever silently vanishes. Both panels read the SAME
// persisted config, so a switch in one is reflected in the other.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { WidgetInstance } from '@/shared/project'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine, createStore } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { CommandRegistry } from '@/platform/commands'
import { ConfigurationService } from '@/services/configuration'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CommandsProvider } from './use-commands'
import { CanvasSettingsProvider } from './use-canvas-settings'
import { registerCanvasCommands } from './canvas-commands'
import { InspectorPanel, DensityConfigProvider } from './inspector-panel'
import { LayersPanel } from './layers-panel'
import { docWith } from './test-harness'

function w(id: string, over: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x: 0, y: 0, w: 40, h: 40 }, ...over }
}

// A fresh, isolated config per render (defaults → Power) shared by BOTH panels, so we
// test real cross-panel persistence without leaning on the module fallback singleton.
function renderDensity(widgets: WidgetInstance[]) {
  const doc = docWith(widgets)
  const model = new ProjectModel(doc)
  const engine = new SelectionEngine(createSelectionStore())
  const undo = new UndoStack()
  const commands = new CommandRegistry()
  registerCanvasCommands(commands, () => ({ model, engine, undo }))
  const canvasSettings = createStore({ snap: true, grid: 8 }, { name: 'canvas', kind: 'temp' })
  const config = new ConfigurationService({ layers: { defaults: { workspace: { density: 'power' } } } })
  const view = render(
    <DensityConfigProvider value={config}>
      <ProjectModelProvider value={model}>
        <SelectionProvider value={engine}>
          <UndoProvider value={undo}>
            <CommandsProvider value={commands}>
              <CanvasSettingsProvider value={canvasSettings}>
                <InspectorPanel pageId={doc.pages[0]!.id} />
                <LayersPanel pageId={doc.pages[0]!.id} />
              </CanvasSettingsProvider>
            </CommandsProvider>
          </UndoProvider>
        </SelectionProvider>
      </ProjectModelProvider>
    </DensityConfigProvider>,
  )
  return { model, engine, undo, config, ...view }
}

const inspector = (c: HTMLElement) => c.querySelector('[data-testid="inspector-panel"]') as HTMLElement
const query = (c: HTMLElement, sel: string) => c.querySelector(sel)
// A pro section by title (the <section> element only — not the same-named chip groups).
const section = (c: HTMLElement, title: string) => c.querySelector(`section.dd-insp-section[aria-label="${title}"]`)

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Density toggle (CD-424)', () => {
  it('defaults to Power — every pro section is present, no Advanced stub', () => {
    const { container, engine } = renderDensity([w('w_aaaaaa')])
    act(() => engine.selectOnly('w_aaaaaa'))
    expect(inspector(container)).toHaveAttribute('data-density', 'power')
    expect(section(container, 'Styles')).toBeInTheDocument()
    expect(section(container, 'Bindings')).toBeInTheDocument()
    expect(section(container, 'States')).toBeInTheDocument()
    expect(section(container, 'Events')).toBeInTheDocument()
    expect(query(container, '[data-testid="advanced-stub"]')).toBeNull()
  })

  it('persists the choice through services/configuration (validated user-layer write)', () => {
    const { container, config } = renderDensity([w('w_aaaaaa')])
    const beginner = query(container, '[data-density-option="beginner"]') as HTMLButtonElement
    act(() => beginner.click())
    // Written to the user layer, not defaults — defaults stay Power, merged view is Beginner.
    expect(config.get('workspace.density')).toBe('beginner')
    expect(config.getLayer('user')).toEqual({ workspace: { density: 'beginner' } })
    expect(config.getLayer('defaults')).toEqual({ workspace: { density: 'power' } })
    expect(inspector(container)).toHaveAttribute('data-density', 'beginner')
  })
})

describe('Beginner density signposts hidden content — never a silent vanish (CD-424 AC)', () => {
  it('hides the pro sections but surfaces an Advanced stub that counts the live bindings', () => {
    const { container, engine, model } = renderDensity([w('w_aaaaaa')])
    act(() => model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'cpu.load' }))
    act(() => engine.selectOnly('w_aaaaaa'))
    // Power: sections visible.
    expect(section(container, 'Bindings')).toBeInTheDocument()

    act(() => (query(container, '[data-density-option="beginner"]') as HTMLButtonElement).click())

    // The four pro sections are gone from the DOM …
    expect(section(container, 'Styles')).toBeNull()
    expect(section(container, 'Bindings')).toBeNull()
    expect(section(container, 'States')).toBeNull()
    expect(section(container, 'Events')).toBeNull()
    // … but never silently: the Advanced stub accounts for them and counts the binding.
    const stub = query(container, '[data-testid="advanced-stub"]') as HTMLElement
    expect(stub).toBeInTheDocument()
    expect(stub).toHaveAttribute('data-bindings', '1')
    expect(stub.textContent).toContain('1 binding')
    // Every hidden section is named in the stub — no unaccounted-for content.
    for (const label of ['Styles', 'Bindings', 'States', 'Events']) {
      expect(stub.querySelector(`[data-advanced-section="${label}"]`)).toBeTruthy()
    }
  })

  it('the Advanced stub switch-to-Power action restores the hidden sections', () => {
    const { container, engine } = renderDensity([w('w_aaaaaa')])
    act(() => engine.selectOnly('w_aaaaaa'))
    act(() => (query(container, '[data-density-option="beginner"]') as HTMLButtonElement).click())
    expect(query(container, '[data-testid="advanced-stub"]')).toBeInTheDocument()

    act(() => (query(container, '[data-testid="switch-to-power"]') as HTMLButtonElement).click())
    expect(query(container, '[data-testid="advanced-stub"]')).toBeNull()
    expect(section(container, 'Bindings')).toBeInTheDocument()
  })

  it('Layers carries a matching Beginner hint (shared config) with its own switch-to-Power', () => {
    const { container, model } = renderDensity([w('w_aaaaaa')])
    act(() => model.setBinding('w_aaaaaa', 'value', { mode: 'variable', src: 'cpu.load' }))
    // Power: no hint in Layers.
    expect(query(container, '[data-testid="layers-density-hint"]')).toBeNull()

    // Switch via the Inspector toggle — the Layers hint appears because BOTH panels read
    // the same persisted config (no silent divergence between the two halves).
    act(() => (query(container, '[data-density-option="beginner"]') as HTMLButtonElement).click())
    const hint = query(container, '[data-testid="layers-density-hint"]') as HTMLElement
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveAttribute('data-bindings', '1')
    expect(hint.textContent).toContain('1 binding')

    // The Layers switch-to-Power clears the hint AND flips the Inspector back (one config).
    act(() => (query(container, '[data-testid="layers-switch-to-power"]') as HTMLButtonElement).click())
    expect(query(container, '[data-testid="layers-density-hint"]')).toBeNull()
    expect(inspector(container)).toHaveAttribute('data-density', 'power')
  })
})
