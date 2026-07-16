import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { type WidgetInstance } from '@/shared/project'
import { renderDeckPane, docWith } from './test-harness'

function w(id: string, x: number): WidgetInstance {
  return { id, type: 'gauge.circular', frame: { x, y: 100, w: 80, h: 60 } }
}

function setup() {
  return renderDeckPane(docWith([w('w_aaaaaa', 0), w('w_bbbbbb', 200), w('w_cccccc', 400)], 'Mini'))
}

const minibar = (c: HTMLElement) => c.querySelector('[data-testid="selection-minibar"]')
const action = (c: HTMLElement, name: string) => c.querySelector(`[data-action="${name}"]`) as HTMLButtonElement

describe('nudge (CD-308)', () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('arrow keys nudge 1 px and coalesce a burst into ONE undo entry', () => {
    const { surface, model, engine, undo } = setup()
    act(() => engine.selectOnly('w_aaaaaa'))
    act(() => {
      for (let i = 0; i < 5; i++) fireEvent.keyDown(surface, { key: 'ArrowRight' })
    })
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(5)
    expect(undo.length).toBe(1) // coalesced burst
    act(() => {
      undo.undo()
    })
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(0) // restores the pre-burst frame
  })

  it('⇧ + arrow nudges by 10 px', () => {
    const { surface, model, engine } = setup()
    act(() => engine.selectOnly('w_aaaaaa'))
    act(() => fireEvent.keyDown(surface, { key: 'ArrowDown', shiftKey: true }))
    expect(model.widget('w_aaaaaa')!.frame.y).toBe(110)
  })

  it('nudge moves every selected widget', () => {
    const { surface, model, engine } = setup()
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    act(() => fireEvent.keyDown(surface, { key: 'ArrowLeft' }))
    expect(model.widget('w_aaaaaa')!.frame.x).toBe(-1)
    expect(model.widget('w_bbbbbb')!.frame.x).toBe(199)
  })
})

describe('selection minibar (CD-308)', () => {
  beforeEach(() => {
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    }
  })

  it('appears on selection and hides when empty', () => {
    const { container, engine } = setup()
    expect(minibar(container)).toBeNull()
    act(() => engine.selectOnly('w_aaaaaa'))
    expect(minibar(container)).toBeTruthy()
    act(() => engine.clear())
    expect(minibar(container)).toBeNull()
  })

  it('duplicate action dispatches the registry command (adds a widget)', () => {
    const { container, model, engine } = setup()
    const before = model.widgetsOf(model.pages()[0]!.id).length
    act(() => engine.selectOnly('w_aaaaaa'))
    act(() => action(container, 'duplicate').click())
    expect(model.widgetsOf(model.pages()[0]!.id).length).toBe(before + 1)
  })

  it('lock action locks the selection', () => {
    const { container, model, engine } = setup()
    act(() => engine.selectOnly('w_aaaaaa'))
    act(() => action(container, 'lock').click())
    expect(model.widget('w_aaaaaa')!.locked).toBe(true)
  })

  it('group appears for a multi-selection and groups via the command', () => {
    const { container, model, engine } = setup()
    act(() => engine.selectMany(['w_aaaaaa', 'w_bbbbbb']))
    const group = action(container, 'group')
    expect(group).toBeTruthy()
    act(() => group.click())
    // A new container widget now exists.
    const containers = model.widgetsOf(model.pages()[0]!.id).filter((x) => x.type === 'core.group')
    expect(containers).toHaveLength(1)
  })

  it('delete action removes the selection via the command', () => {
    const { container, model, engine } = setup()
    act(() => engine.selectOnly('w_bbbbbb'))
    act(() => action(container, 'delete').click())
    expect(model.widget('w_bbbbbb')).toBeUndefined()
    expect(engine.state.ids).toEqual([])
  })
})

describe('tool shortcuts (CD-308)', () => {
  it('V/H/I switch the active tool', () => {
    const { container, surface } = setup()
    const pane = container.querySelector('[data-pane="deck-designer"]')!
    expect(pane).toHaveAttribute('data-tool', 'select')
    act(() => fireEvent.keyDown(surface, { key: 'h' }))
    expect(pane).toHaveAttribute('data-tool', 'hand')
    act(() => fireEvent.keyDown(surface, { key: 'i' }))
    expect(pane).toHaveAttribute('data-tool', 'insert')
    act(() => fireEvent.keyDown(surface, { key: 'v' }))
    expect(pane).toHaveAttribute('data-tool', 'select')
  })
})
