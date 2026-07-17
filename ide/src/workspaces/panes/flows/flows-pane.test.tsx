import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { UndoStack } from '@/platform/undo'
import { MemoryStorageAdapter, type StorageAdapter } from '@/services/persistence'
import { UndoProvider } from '../deck-designer/use-undo'
import FlowsPane from '../flows-pane'
import { FlowsProvider } from './use-flows'
import { FlowsService, localFlowsPersistence } from './flows-service'

function mount(adapter: StorageAdapter = new MemoryStorageAdapter(), undo = new UndoStack()) {
  const service = new FlowsService({ persistence: localFlowsPersistence(adapter), debounceMs: 1 })
  const view = render(
    <UndoProvider value={undo}>
      <FlowsProvider value={service}>
        <FlowsPane />
      </FlowsProvider>
    </UndoProvider>,
  )
  return { ...view, service, undo, adapter }
}

/** Let the pane's load() effect + its debounced write-back settle. */
async function settle(service: FlowsService) {
  await act(async () => {
    await service.load()
    await service.flush()
  })
}

describe('FlowsPane (CD-409)', () => {
  it('loads the collection and renders a tab per flow', async () => {
    const { service } = mount()
    await settle(service)
    expect(screen.getByTestId('tab-flow_strt0001')).toHaveTextContent('Stream Start')
    expect(screen.getByTestId('tab-flow_lite0001')).toHaveTextContent('Toggle Lights')
    expect(document.querySelector('[data-pane="flows"]')).toHaveAttribute('data-status', 'ready')
  })

  it('shows a loading state before the collection arrives, never a broken pane', () => {
    const { container } = mount()
    expect(container.querySelector('[data-pane="flows"]')).toHaveAttribute('data-status', 'loading')
    expect(screen.getByText('Loading flows…')).toBeTruthy()
  })

  it('surfaces a load failure honestly instead of rendering empty tabs', async () => {
    const service = new FlowsService({
      persistence: {
        query: async () => {
          throw new Error('gateway down')
        },
        create: async () => ({}),
        update: async () => ({}),
        remove: async () => {},
      },
    })
    render(
      <UndoProvider value={new UndoStack()}>
        <FlowsProvider value={service}>
          <FlowsPane />
        </FlowsProvider>
      </UndoProvider>,
    )
    await act(async () => void (await service.load()))
    expect(screen.getByText('Flows could not be loaded.')).toBeTruthy()
  })

  it('switching tabs is reflected in the strip', async () => {
    const { service } = mount()
    await settle(service)
    fireEvent.click(screen.getByTestId('tab-flow_lite0001'))
    expect(screen.getByTestId('tab-flow_lite0001')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-flow_strt0001')).toHaveAttribute('aria-selected', 'false')
  })

  it('a new flow becomes the active tab; undoing it falls back to the first', async () => {
    const undo = new UndoStack()
    const { service } = mount(new MemoryStorageAdapter(), undo)
    await settle(service)
    fireEvent.click(screen.getByTestId('new-flow'))
    const created = service.model!.list()[2]!
    expect(screen.getByTestId(`tab-${created.id}`)).toHaveAttribute('aria-selected', 'true')

    act(() => void undo.undo())
    expect(screen.queryByTestId(`tab-${created.id}`)).toBeNull()
    expect(screen.getByTestId('tab-flow_strt0001')).toHaveAttribute('aria-selected', 'true')
  })

  it('edits made in the pane persist and restore in the next session (AC)', async () => {
    const adapter = new MemoryStorageAdapter()
    const { service, unmount } = mount(adapter)
    await settle(service)

    fireEvent.doubleClick(screen.getByTestId('tab-flow_lite0001'))
    fireEvent.change(screen.getByTestId('rename-flow_lite0001'), { target: { value: 'Lights Out' } })
    fireEvent.keyDown(screen.getByTestId('rename-flow_lite0001'), { key: 'Enter' })
    fireEvent.click(screen.getByTestId('tab-flow_lite0001'))
    fireEvent.click(screen.getByTestId('armed-toggle'))
    fireEvent.click(screen.getByTestId('confirm-arm'))
    await act(async () => void (await service.flush()))
    unmount()

    // Second session: same storage, a brand-new service + pane.
    const next = mount(adapter)
    await settle(next.service)
    expect(screen.getByTestId('tab-flow_lite0001')).toHaveTextContent('Lights Out')
    expect(screen.getByTestId('tab-flow_lite0001')).toHaveAttribute('data-armed', 'true')
    fireEvent.click(screen.getByTestId('tab-flow_lite0001'))
    expect(screen.getByTestId('armed-toggle')).toHaveAttribute('aria-pressed', 'true')
  })

  it('flow edits ride the shell undo stack the canvas uses (⌘Z reverses them)', async () => {
    const undo = new UndoStack()
    const { service } = mount(new MemoryStorageAdapter(), undo)
    await settle(service)
    fireEvent.doubleClick(screen.getByTestId('tab-flow_strt0001'))
    fireEvent.change(screen.getByTestId('rename-flow_strt0001'), { target: { value: 'Go Live' } })
    fireEvent.keyDown(screen.getByTestId('rename-flow_strt0001'), { key: 'Enter' })

    expect(undo.list().map((e) => e.label)).toEqual(['Rename flow'])
    act(() => void undo.undo())
    expect(screen.getByTestId('tab-flow_strt0001')).toHaveTextContent('Stream Start')
  })

  it('falls back to the shared default service when no FlowsProvider is mounted', () => {
    // The composition root wires no gateway yet, so the pane must stand up on its own
    // local-persistence service rather than throwing at the pane host.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <UndoProvider value={new UndoStack()}>
          <FlowsPane />
        </UndoProvider>,
      )
      expect(document.querySelector('[data-pane="flows"]')).toBeTruthy()
    } finally {
      spy.mockRestore()
    }
  })
})
