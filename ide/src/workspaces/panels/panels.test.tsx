import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { createStore } from '@/stores'
import {
  ResizablePanel,
  panelFor,
  setPanelWidth,
  togglePanel,
  clampWidth,
  PANEL_MIN,
  PANEL_MAX,
  type PanelsState,
} from '@/workspaces'

const panelStore = () =>
  createStore<PanelsState>({ panels: {} }, { name: 'workspace', kind: 'persisted', location: 'cdk-layout' })

describe('panels model — clamp + per-workspace persistence', () => {
  it('clamps width to [MIN, MAX]', () => {
    expect(clampWidth(10)).toBe(PANEL_MIN)
    expect(clampWidth(9999)).toBe(PANEL_MAX)
    expect(clampWidth(300)).toBe(300)
  })

  it('widths are stored + clamped per workspace, independently', () => {
    const store = panelStore()
    setPanelWidth(store, 'flows', 'left', 320)
    setPanelWidth(store, 'flows', 'left', 9999) // clamps
    setPanelWidth(store, 'variables', 'left', 200)
    expect(panelFor(store.getState(), 'flows').leftWidth).toBe(PANEL_MAX)
    expect(panelFor(store.getState(), 'variables').leftWidth).toBe(200)
    // unseen workspace → defaults
    expect(panelFor(store.getState(), 'home').leftVisible).toBe(true)
  })

  it('toggle hides/shows a side', () => {
    const store = panelStore()
    expect(panelFor(store.getState(), 'flows').leftVisible).toBe(true)
    togglePanel(store, 'flows', 'left')
    expect(panelFor(store.getState(), 'flows').leftVisible).toBe(false)
    togglePanel(store, 'flows', 'left')
    expect(panelFor(store.getState(), 'flows').leftVisible).toBe(true)
  })
})

describe('ResizablePanel — component', () => {
  it('renders the panel at its width with a resize separator', () => {
    const { container } = renderWithProviders(
      <ResizablePanel side="left" width={300} visible onResize={() => {}} onToggle={() => {}} label="Explorer" />,
    )
    const panel = container.querySelector('[data-panel="left"]') as HTMLElement
    expect(panel.style.width).toBe('300px')
    const sep = container.querySelector('[role="separator"]')!
    expect(sep).toHaveAttribute('aria-valuenow', '300')
  })

  it('keyboard resize: Arrow keys grow/shrink within the clamp', () => {
    const widths: number[] = []
    const { container } = renderWithProviders(
      <ResizablePanel side="left" width={300} visible onResize={(w) => widths.push(w)} onToggle={() => {}} label="Explorer" />,
    )
    const sep = container.querySelector('[data-panel-handle="left"]')!
    act(() => sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    act(() => sep.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
    expect(widths[0]).toBe(316) // grew by STEP
    expect(widths[1]).toBe(284) // shrank by STEP
  })

  it('hidden panel shows a reopen affordance that toggles', () => {
    const onToggle = vi.fn()
    const { container } = renderWithProviders(
      <ResizablePanel side="left" width={300} visible={false} onResize={() => {}} onToggle={onToggle} label="Explorer" />,
    )
    const reopen = container.querySelector('[data-panel-reopen="left"]')!
    expect(reopen).toHaveAttribute('aria-label', 'Show Explorer')
    act(() => (reopen as HTMLButtonElement).click())
    expect(onToggle).toHaveBeenCalled()
  })
})
