import { describe, it, expect } from 'vitest'
import { render, renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { CyberDeckWidgetManifestV2 as WidgetManifest } from '@/shared/contract'
import { ProjectModel } from '@/shared/project'
import { createSelectionStore, SelectionEngine, CanvasViewBus } from '@/stores'
import { UndoStack } from '@/platform/undo'
import { ProjectModelProvider } from './use-project-model'
import { SelectionProvider } from './use-selection'
import { UndoProvider } from './use-undo'
import { CanvasViewProvider } from './use-canvas-view'
import { InsertPanel } from './insert-panel'
import {
  WidgetCatalogProvider,
  useInsertCatalog,
  insertManifestFromWidget,
  type WidgetCatalogRegistry,
} from './widget-catalog'

/** A minimal live registry (list + subscribe) — the shape the shell's WidgetRegistry
 *  satisfies — so the test drives the "zero wiring" path without a real bus. */
function fakeRegistry(initial: WidgetManifest[] = []) {
  let manifests = [...initial]
  const listeners = new Set<() => void>()
  return {
    list: () => manifests,
    subscribe: (cb: () => void) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    add(m: WidgetManifest) {
      manifests = [...manifests, m]
      listeners.forEach((l) => l())
    },
  } satisfies WidgetCatalogRegistry & { add(m: WidgetManifest): void }
}

const manifest = (id: string, label: string, category = 'Custom'): WidgetManifest =>
  ({ id, version: '1.0.0', metadata: { label, category, icon: '★' } }) as WidgetManifest

function catalogWrapper(registry: WidgetCatalogRegistry) {
  return ({ children }: { children: ReactNode }) => (
    <WidgetCatalogProvider value={registry}>{children}</WidgetCatalogProvider>
  )
}

describe('useInsertCatalog (CD-421)', () => {
  it('falls back to the static catalog when no registry is bound', () => {
    const { result } = renderHook(() => useInsertCatalog())
    // The static CD-315 catalog has the canon gauge.
    expect(result.current.some((m) => m.type === 'gauge.circular')).toBe(true)
  })

  it('reflects the platform registry, live, when one is bound (zero-wiring)', () => {
    const registry = fakeRegistry([manifest('plugin.meter', 'Plugin Meter')])
    const { result } = renderHook(() => useInsertCatalog(), { wrapper: catalogWrapper(registry) })
    expect(result.current.map((m) => m.type)).toEqual(['plugin.meter'])

    act(() => registry.add(manifest('plugin.dial', 'Plugin Dial')))
    expect(result.current.map((m) => m.type)).toEqual(['plugin.meter', 'plugin.dial'])
  })

  it('maps a manifest onto the InsertManifest shape', () => {
    const m = insertManifestFromWidget(manifest('plugin.meter', 'Plugin Meter', 'Data'))
    expect(m).toMatchObject({ type: 'plugin.meter', label: 'Plugin Meter', category: 'Data', icon: '★' })
    expect(m.defaultSize).toEqual({ w: 200, h: 160 })
  })
})

describe('Insert panel over the registry (CD-421 AC)', () => {
  function renderInsertWith(registry: WidgetCatalogRegistry) {
    const model = ProjectModel.empty('I')
    const engine = new SelectionEngine(createSelectionStore())
    const undo = new UndoStack()
    const bus = new CanvasViewBus()
    return render(
      <ProjectModelProvider value={model}>
        <SelectionProvider value={engine}>
          <UndoProvider value={undo}>
            <CanvasViewProvider value={bus}>
              <WidgetCatalogProvider value={registry}>
                <InsertPanel pageId={model.pages()[0]!.id} />
              </WidgetCatalogProvider>
            </CanvasViewProvider>
          </UndoProvider>
        </SelectionProvider>
      </ProjectModelProvider>,
    )
  }

  it('shows a registered manifest as a tile, and a runtime registration appears with zero extra wiring', () => {
    const registry = fakeRegistry([manifest('plugin.meter', 'Plugin Meter')])
    const view = renderInsertWith(registry)
    expect(view.getByText('Plugin Meter')).toBeInTheDocument()

    // Register another manifest at runtime → it surfaces in the Insert panel unaided.
    act(() => registry.add(manifest('plugin.dial', 'Plugin Dial')))
    expect(view.getByText('Plugin Dial')).toBeInTheDocument()
  })
})
