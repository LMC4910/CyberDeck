import { describe, expect, it } from 'vitest'
import { UndoStack } from '@/platform/undo'

// A sample model + a "set field to value" helper whose apply returns the inverse.
function model() {
  const state = { x: 0, label: '' }
  const setX = (v: number) => (): (() => void) => {
    const prev = state.x
    state.x = v
    return () => {
      state.x = prev
    }
  }
  return { state, setX }
}

describe('UndoStack — do/undo/redo identity', () => {
  it('undo reverts to the prior state; redo re-applies (do→undo = identity)', () => {
    const m = model()
    const stack = new UndoStack({ now: () => 0 })
    stack.execUndoable('Set 5', m.setX(5))
    expect(m.state.x).toBe(5)
    expect(stack.undo()).toBe(true)
    expect(m.state.x).toBe(0) // identity: back to original
    expect(stack.redo()).toBe(true)
    expect(m.state.x).toBe(5)
  })

  it('a new action truncates the redo tail', () => {
    const m = model()
    const stack = new UndoStack({ now: () => 0 })
    stack.execUndoable('a', m.setX(1))
    stack.execUndoable('b', m.setX(2))
    stack.undo() // back to x=1
    stack.execUndoable('c', m.setX(3)) // truncates 'b'
    expect(stack.canRedo).toBe(false)
    expect(stack.length).toBe(2) // a, c
    expect(m.state.x).toBe(3)
  })

  it('returns a toast payload', () => {
    const stack = new UndoStack({ now: () => 0 })
    const toast = stack.execUndoable('Move widget', model().setX(1))
    expect(toast.message).toBe('Move widget — ⌘Z to undo')
  })
})

describe('UndoStack — coalescing', () => {
  it('same-key edits within the window collapse into one step', () => {
    const m = model()
    let t = 0
    const stack = new UndoStack({ now: () => t, coalesceWindowMs: 1000 })
    stack.execUndoable('Drag', m.setX(1), { coalesceKey: 'drag' })
    t = 100
    stack.execUndoable('Drag', m.setX(2), { coalesceKey: 'drag' })
    t = 200
    stack.execUndoable('Drag', m.setX(3), { coalesceKey: 'drag' })
    expect(stack.length).toBe(1) // one coalesced entry
    expect(m.state.x).toBe(3)
    stack.undo()
    expect(m.state.x).toBe(0) // reverts the whole gesture
    stack.redo()
    expect(m.state.x).toBe(3) // re-applies the final value
  })

  it('same key outside the window does NOT coalesce', () => {
    const m = model()
    let t = 0
    const stack = new UndoStack({ now: () => t, coalesceWindowMs: 1000 })
    stack.execUndoable('Drag', m.setX(1), { coalesceKey: 'drag' })
    t = 2000 // past the window
    stack.execUndoable('Drag', m.setX(2), { coalesceKey: 'drag' })
    expect(stack.length).toBe(2)
  })
})

describe('UndoStack — jump-to-index', () => {
  it('jumps backward and forward across multiple entries', () => {
    const m = model()
    const stack = new UndoStack({ now: () => 0 })
    stack.execUndoable('a', m.setX(1))
    stack.execUndoable('b', m.setX(2))
    stack.execUndoable('c', m.setX(3))
    stack.jumpTo(1) // apply only 'a'
    expect(m.state.x).toBe(1)
    expect(stack.index).toBe(1)
    stack.jumpTo(3) // re-apply through 'c'
    expect(m.state.x).toBe(3)
    stack.jumpTo(0) // back to initial
    expect(m.state.x).toBe(0)
  })
})

describe('UndoStack — depth cap', () => {
  it('drops the oldest entry past the cap', () => {
    const m = model()
    const stack = new UndoStack({ now: () => 0, cap: 2 })
    stack.execUndoable('a', m.setX(1))
    stack.execUndoable('b', m.setX(2))
    stack.execUndoable('c', m.setX(3)) // 'a' falls off
    expect(stack.length).toBe(2)
    expect(stack.list().map((e) => e.label)).toEqual(['b', 'c'])
    // can only undo back to the point 'a' left the stack (x stays >= 1)
    stack.undo() // undo c → x=2
    stack.undo() // undo b → x=1 (a's revert is gone with a)
    expect(stack.canUndo).toBe(false)
    expect(m.state.x).toBe(1)
  })
})

describe('UndoStack — empty guards', () => {
  it('undo/redo on empty return false', () => {
    const stack = new UndoStack()
    expect(stack.undo()).toBe(false)
    expect(stack.redo()).toBe(false)
  })
})
