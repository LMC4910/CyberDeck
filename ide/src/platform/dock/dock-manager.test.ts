import { describe, expect, it } from 'vitest'
import { DockManager, DockError } from '@/platform/dock'

function mgr() {
  const m = new DockManager()
  m.register({ id: 'mirror', defaultSide: 'right', minSize: 200, defaultSize: 300 })
  return m
}

describe('DockManager — registration', () => {
  it('registers docked+pinned by default at its side/size', () => {
    const m = mgr()
    const w = m.get('mirror')!
    expect(w).toMatchObject({ mode: 'docked', side: 'right', size: 300, pinned: true, autohidden: false })
  })
  it('rejects duplicate registration', () => {
    const m = mgr()
    expect(() => m.register({ id: 'mirror', defaultSide: 'left', minSize: 100 })).toThrow(DockError)
  })
  it('clamps default size to minSize', () => {
    const m = new DockManager()
    m.register({ id: 'x', defaultSide: 'left', minSize: 250, defaultSize: 100 })
    expect(m.get('x')!.size).toBe(250)
  })
})

describe('DockManager — legal transitions', () => {
  it('float → dock → move zone', () => {
    const m = mgr()
    expect(m.float('mirror').mode).toBe('float')
    expect(m.dock('mirror', 'left')).toMatchObject({ mode: 'docked', side: 'left', pinned: true })
    expect(m.moveZone('mirror', 'bottom').side).toBe('bottom')
  })

  it('pin → unpin → peek → unpeek → re-pin', () => {
    const m = mgr()
    // starts pinned; unpin → auto-hidden edge tab
    expect(m.unpin('mirror')).toMatchObject({ pinned: false, autohidden: true, peeking: false })
    // peek → temporary show
    expect(m.peek('mirror')).toMatchObject({ autohidden: true, peeking: true })
    // unpeek → back to tab
    expect(m.unpeek('mirror')).toMatchObject({ peeking: false })
    // re-pin → inset content again
    expect(m.pin('mirror')).toMatchObject({ pinned: true, autohidden: false })
  })

  it('resize clamps to minSize', () => {
    const m = mgr()
    expect(m.resize('mirror', 50).size).toBe(200) // min
    expect(m.resize('mirror', 420).size).toBe(420)
  })

  it('floating loses pin/auto-hide state', () => {
    const m = mgr()
    m.unpin('mirror') // auto-hidden
    expect(m.float('mirror')).toMatchObject({ mode: 'float', pinned: false, autohidden: false, peeking: false })
  })
})

describe('DockManager — illegal transitions rejected', () => {
  it('float when already floating', () => {
    const m = mgr()
    m.float('mirror')
    expect(() => m.float('mirror')).toThrow(/already floating/)
  })
  it('dock to the same side', () => {
    const m = mgr()
    expect(() => m.dock('mirror', 'right')).toThrow(/already docked right/)
  })
  it('move zone / pin / unpin on a floating window', () => {
    const m = mgr()
    m.float('mirror')
    expect(() => m.moveZone('mirror', 'left')).toThrow(DockError)
    expect(() => m.pin('mirror')).toThrow(DockError)
    expect(() => m.unpin('mirror')).toThrow(DockError)
  })
  it('pin when already pinned; unpin when already unpinned', () => {
    const m = mgr()
    expect(() => m.pin('mirror')).toThrow(/already pinned/)
    m.unpin('mirror')
    expect(() => m.unpin('mirror')).toThrow(/already unpinned/)
  })
  it('peek a pinned window; unpeek when not peeking', () => {
    const m = mgr()
    expect(() => m.peek('mirror')).toThrow(/only auto-hidden/) // pinned
    expect(() => m.unpeek('mirror')).toThrow(/not peeking/)
  })
  it('operating on an unknown window', () => {
    const m = mgr()
    expect(() => m.float('ghost')).toThrow(/no tool window "ghost"/)
  })
})

describe('DockManager — persistence', () => {
  it('serialize → hydrate round-trips the model', () => {
    const m = mgr()
    m.unpin('mirror')
    m.resize('mirror', 260)
    const rows = m.serialize()

    const m2 = new DockManager()
    m2.hydrate(rows)
    expect(m2.get('mirror')).toMatchObject({ pinned: false, autohidden: true, size: 260, side: 'right' })
  })
})
