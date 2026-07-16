import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { ProjectModel, type WidgetInstance } from '@/shared/project'
import { CanvasViewBus } from '@/stores'
import { ProjectModelProvider } from './use-project-model'
import { CanvasViewProvider } from './use-canvas-view'
import { Minimap } from './minimap'
import { LiveMirror } from './live-mirror'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 0, w: 80, h: 60 } }
}

function doc(widgets: WidgetInstance[]) {
  const model = new ProjectModel({
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'M' },
    pages: [{ id: 'page_mmtst0', name: 'P', canvas: { w: 800, h: 600 }, widgets }],
  })
  return model
}

beforeEach(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
})

describe('Minimap (CD-314)', () => {
  it('renders a cell per visible widget from the board model', () => {
    const model = doc([w('w_aaaaaa', 0), w('w_bbbbbb', 200)])
    const bus = new CanvasViewBus()
    const { container } = render(
      <ProjectModelProvider value={model}>
        <CanvasViewProvider value={bus}>
          <Minimap pageId="page_mmtst0" />
        </CanvasViewProvider>
      </ProjectModelProvider>,
    )
    expect(container.querySelectorAll('.dd-minimap-cell')).toHaveLength(2)
  })

  it('updates live when the board changes (same selector as the mirror)', () => {
    const model = doc([w('w_aaaaaa', 0)])
    const bus = new CanvasViewBus()
    const { container } = render(
      <ProjectModelProvider value={model}>
        <CanvasViewProvider value={bus}>
          <Minimap pageId="page_mmtst0" />
        </CanvasViewProvider>
      </ProjectModelProvider>,
    )
    expect(container.querySelectorAll('.dd-minimap-cell')).toHaveLength(1)
    act(() => {
      model.addWidget('page_mmtst0', w('w_bbbbbb', 300))
    })
    expect(container.querySelectorAll('.dd-minimap-cell')).toHaveLength(2)
  })

  it('shows the viewport rect from the shared view and recenters on click', () => {
    const model = doc([w('w_aaaaaa', 0)])
    const bus = new CanvasViewBus()
    const centered: { x: number; y: number }[] = []
    bus.registerNavigator((p) => centered.push(p))
    bus.setView({ scale: 1, tx: 0, ty: 0 }, { w: 400, h: 300 })
    const { container } = render(
      <ProjectModelProvider value={model}>
        <CanvasViewProvider value={bus}>
          <Minimap pageId="page_mmtst0" />
        </CanvasViewProvider>
      </ProjectModelProvider>,
    )
    expect(container.querySelector('[data-testid="minimap-viewport"]')).toBeTruthy()
    const mini = container.querySelector('[data-testid="minimap"]') as HTMLElement
    mini.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 165, right: 220, bottom: 165, x: 0, y: 0 }) as DOMRect
    fireEvent.pointerDown(mini, { clientX: 55, clientY: 41 })
    expect(centered).toHaveLength(1) // navigated the canvas
  })
})

describe('LiveMirror (CD-314)', () => {
  it('renders the board in a device frame and cycles devices', () => {
    const model = doc([w('w_aaaaaa', 0), w('w_bbbbbb', 200)])
    const { container, getByTestId } = render(
      <ProjectModelProvider value={model}>
        <LiveMirror pageId="page_mmtst0" />
      </ProjectModelProvider>,
    )
    expect(container.querySelectorAll('.dd-mirror-cell')).toHaveLength(2)
    const btn = getByTestId('mirror-device')
    expect(btn).toHaveTextContent('iPad')
    act(() => btn.click())
    expect(btn).toHaveTextContent('Pixel')
    expect(container.querySelector('[data-device="pixel"]')).toBeTruthy()
  })

  it('updates live on board change', () => {
    const model = doc([w('w_aaaaaa', 0)])
    const { container } = render(
      <ProjectModelProvider value={model}>
        <LiveMirror pageId="page_mmtst0" />
      </ProjectModelProvider>,
    )
    act(() => {
      model.addWidget('page_mmtst0', w('w_bbbbbb', 300))
    })
    expect(container.querySelectorAll('.dd-mirror-cell')).toHaveLength(2)
  })
})
