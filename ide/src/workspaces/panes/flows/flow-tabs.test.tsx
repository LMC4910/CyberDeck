import { describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { UndoStack } from '@/platform/undo'
import { MemoryStorageAdapter } from '@/services/persistence'
import { FlowsService, localFlowsPersistence } from './flows-service'
import { FlowTabs } from './flow-tabs'
import type { FlowsCtx } from './flow-ops'
import type { FlowModel } from './flow-model'

async function renderTabs(activeId: string | null = 'flow_strt0001') {
  const arm = vi.fn(async () => {})
  const service = new FlowsService({
    persistence: { ...localFlowsPersistence(new MemoryStorageAdapter()), arm },
    debounceMs: 10_000,
  })
  await service.load()
  const model = service.model as FlowModel
  const undo = new UndoStack()
  const ctx: FlowsCtx = { model, undo, service }
  const onActivate = vi.fn()
  const view = render(<FlowTabs ctx={ctx} activeId={activeId} onActivate={onActivate} />)
  return { ...view, ctx, model, undo, arm, onActivate }
}

describe('FlowTabs — switch (CD-409)', () => {
  it('renders one tab per flow with the active one selected', async () => {
    const { getByTestId } = await renderTabs()
    expect(getByTestId('tab-flow_strt0001')).toHaveAttribute('aria-selected', 'true')
    expect(getByTestId('tab-flow_lite0001')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tablist', { name: 'Flows' })).toBeTruthy()
  })

  it('clicking a tab activates its flow', async () => {
    const { getByTestId, onActivate } = await renderTabs()
    fireEvent.click(getByTestId('tab-flow_lite0001'))
    expect(onActivate).toHaveBeenCalledWith('flow_lite0001')
  })

  it('←/→ move between tabs — the strip is keyboard-operable despite roving tabindex', async () => {
    const { getByTestId, onActivate } = await renderTabs()
    // only the selected tab is in the tab order, so arrows must do the walking
    expect(getByTestId('tab-flow_lite0001')).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Flows' }), { key: 'ArrowRight' })
    expect(onActivate).toHaveBeenLastCalledWith('flow_lite0001')
    // wraps around backwards from the first tab
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Flows' }), { key: 'ArrowLeft' })
    expect(onActivate).toHaveBeenLastCalledWith('flow_lite0001')
  })

  it('the armed flow carries a labelled marker', async () => {
    const { getByTestId } = await renderTabs()
    expect(getByTestId('tab-flow_strt0001')).toHaveAttribute('data-armed', 'true')
    expect(getByTestId('tab-flow_lite0001')).not.toHaveAttribute('data-armed')
    expect(screen.getByRole('img', { name: 'Armed' })).toBeTruthy()
  })
})

describe('FlowTabs — inline rename (CD-409 AC: Esc cancels)', () => {
  it('double-click opens the editor seeded with the current label', async () => {
    const { getByTestId } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    expect(getByTestId('rename-flow_strt0001')).toHaveValue('Stream Start')
  })

  it('Enter commits the rename as one undo entry', async () => {
    const { getByTestId, model, undo } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    fireEvent.change(getByTestId('rename-flow_strt0001'), { target: { value: 'Go Live' } })
    fireEvent.keyDown(getByTestId('rename-flow_strt0001'), { key: 'Enter' })

    expect(model.flow('flow_strt0001')!.label).toBe('Go Live')
    expect(undo.length).toBe(1)
    act(() => void undo.undo())
    expect(model.flow('flow_strt0001')!.label).toBe('Stream Start')
  })

  it('Esc cancels — the label is untouched and nothing lands on the undo stack', async () => {
    const { getByTestId, model, undo } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    fireEvent.change(getByTestId('rename-flow_strt0001'), { target: { value: 'Discarded' } })
    fireEvent.keyDown(getByTestId('rename-flow_strt0001'), { key: 'Escape' })

    expect(model.flow('flow_strt0001')!.label).toBe('Stream Start')
    expect(undo.length).toBe(0)
    expect(getByTestId('tab-flow_strt0001')).toBeTruthy() // editor closed
  })

  it('Esc followed by a blur still cannot write the discarded draft', async () => {
    const { getByTestId, model, undo } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    const input = getByTestId('rename-flow_strt0001')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(model.flow('flow_strt0001')!.label).toBe('Stream Start')
    expect(undo.length).toBe(0)
  })

  it('blur commits the rename', async () => {
    const { getByTestId, model } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    fireEvent.change(getByTestId('rename-flow_strt0001'), { target: { value: 'Blurred' } })
    fireEvent.blur(getByTestId('rename-flow_strt0001'))
    expect(model.flow('flow_strt0001')!.label).toBe('Blurred')
  })

  it('an empty or unchanged name is not written', async () => {
    const { getByTestId, model, undo } = await renderTabs()
    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    fireEvent.change(getByTestId('rename-flow_strt0001'), { target: { value: '   ' } })
    fireEvent.keyDown(getByTestId('rename-flow_strt0001'), { key: 'Enter' })
    expect(model.flow('flow_strt0001')!.label).toBe('Stream Start')

    fireEvent.doubleClick(getByTestId('tab-flow_strt0001'))
    fireEvent.keyDown(getByTestId('rename-flow_strt0001'), { key: 'Enter' })
    expect(undo.length).toBe(0)
  })
})

describe('FlowTabs — new flow (CD-409)', () => {
  it('+ appends an empty flow, activates it, and is undoable', async () => {
    const { getByTestId, model, undo, onActivate } = await renderTabs()
    fireEvent.click(getByTestId('new-flow'))

    expect(model.list()).toHaveLength(3)
    const created = model.list()[2]!
    expect(created.label).toBe('Flow 3')
    expect(created.nodes).toEqual([])
    expect(created.armed).toBe(false)
    expect(onActivate).toHaveBeenCalledWith(created.id)

    expect(undo.length).toBe(1)
    act(() => void undo.undo())
    expect(model.list()).toHaveLength(2)
    // redo re-adds the SAME id rather than minting a fresh key
    act(() => void undo.redo())
    expect(model.list()[2]!.id).toBe(created.id)
  })

  it('default labels do not collide with an existing one', async () => {
    const { getByTestId, model } = await renderTabs()
    act(() => void model.renameFlow('flow_lite0001', 'Flow 3'))
    fireEvent.click(getByTestId('new-flow'))
    expect(model.list()[2]!.label).toBe('Flow 4')
  })
})

describe('FlowTabs — armed toggle with confirm (CD-409)', () => {
  it('arming asks first; cancelling leaves the flow disarmed', async () => {
    const { getByTestId, model, undo, arm } = await renderTabs('flow_lite0001')
    fireEvent.click(getByTestId('armed-toggle'))
    expect(screen.getByRole('dialog', { name: 'Arm flow' })).toBeTruthy()

    fireEvent.click(screen.getByText('Cancel'))
    expect(model.armed('flow_lite0001')).toBe(false)
    expect(undo.length).toBe(0)
    expect(arm).not.toHaveBeenCalled()
    expect(getByTestId('tab-flow_lite0001')).not.toHaveAttribute('data-armed')
  })

  it('confirming arms the flow, drives the arm route, and is undoable both ways', async () => {
    const { getByTestId, model, undo, arm } = await renderTabs('flow_lite0001')
    fireEvent.click(getByTestId('armed-toggle'))
    fireEvent.click(getByTestId('confirm-arm'))

    expect(model.armed('flow_lite0001')).toBe(true)
    expect(getByTestId('armed-toggle')).toHaveAttribute('aria-pressed', 'true')
    expect(arm).toHaveBeenLastCalledWith('flow_lite0001', true)
    expect(undo.length).toBe(1)

    act(() => void undo.undo())
    expect(model.armed('flow_lite0001')).toBe(false)
    // undoing an arm must really disarm the trigger, not just the document
    expect(arm).toHaveBeenLastCalledWith('flow_lite0001', false)
    act(() => void undo.redo())
    expect(model.armed('flow_lite0001')).toBe(true)
    expect(arm).toHaveBeenLastCalledWith('flow_lite0001', true)
  })

  it('disarming is immediate — the confirm guards only the firing direction', async () => {
    const { getByTestId, model, undo, arm } = await renderTabs()
    fireEvent.click(getByTestId('armed-toggle')) // flow_strt0001 seeds armed
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(model.armed('flow_strt0001')).toBe(false)
    expect(arm).toHaveBeenLastCalledWith('flow_strt0001', false)
    expect(undo.length).toBe(1)
  })

  it('with no flow selected the toggle is disabled, not silently inert', async () => {
    const { getByTestId } = await renderTabs(null)
    expect(getByTestId('armed-toggle')).toBeDisabled()
  })
})
