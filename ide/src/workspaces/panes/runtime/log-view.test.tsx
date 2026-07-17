import { describe, expect, it, vi } from 'vitest'
import { Profiler } from 'react'
import { act, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import { createRuntimeStore, RUNTIME_CAP } from '@/stores'
import { MockRuntimeFeed } from './runtime-feed'
import { LogView } from './log-view'

/**
 * Drives the view with a hand-cranked frame scheduler + clock: `flush()` is the
 * animation frame the component would have waited for, so every assertion about
 * batching, pausing and stepping is deterministic rather than timing-dependent.
 */
function setup(options: { rate?: number } = {}) {
  const feed = new MockRuntimeFeed({ rate: options.rate ?? 50 })
  const store = createRuntimeStore()
  let queued: (() => void) | null = null
  let clock = 1_000_000
  // Profiler.onRender fires once per commit of the subtree — the honest measure of
  // "did a burst of events cost one render pass or fifty".
  const commits = { count: 0 }

  const view = renderWithProviders(
    <Profiler
      id="log"
      onRender={() => {
        commits.count++
      }}
    >
      <LogView
        feed={feed}
        store={store}
        now={() => clock}
        scheduleFlush={(fn) => {
          queued = fn
          return 1
        }}
        cancelFlush={() => {
          queued = null
        }}
      />
    </Profiler>,
  )

  return {
    ...view,
    feed,
    store,
    commits,
    advance: (ms: number) => {
      clock += ms
    },
    /** Emit n entries as the stream would — no frame runs until flush(). */
    emit: (n: number, entry?: Parameters<MockRuntimeFeed['emit']>[0]) => {
      act(() => {
        for (let i = 0; i < n; i++) feed.emit(entry)
      })
    },
    flush: () => {
      act(() => {
        const fn = queued
        queued = null
        fn?.()
      })
    },
    isFramePending: () => queued !== null,
    rows: () => view.container.querySelectorAll('[data-testid="log-row"]'),
    btn: (id: string) => view.getByTestId(id) as HTMLButtonElement,
  }
}

describe('LogView — sustained stream (CD-407 AC: 50 events/s without jank)', () => {
  it('coalesces a whole second of events (50) into ONE commit', () => {
    const t = setup()
    const before = t.commits.count
    t.emit(50)
    // arrivals are held in a ref: nothing has rendered, nothing is in the store yet
    expect(t.commits.count).toBe(before)
    expect(t.store.getState().entries).toHaveLength(0)
    expect(t.isFramePending()).toBe(true)

    t.flush()
    expect(t.store.getState().entries).toHaveLength(50)
    // one frame → one commit, regardless of how many events arrived in it
    expect(t.commits.count).toBe(before + 1)
  })

  it('mounts only a window of rows while 5 seconds of events (250) stream in', () => {
    const t = setup()
    t.emit(250)
    t.flush()
    expect(t.store.getState().entries).toHaveLength(250)
    const mounted = t.rows().length
    expect(mounted).toBeGreaterThan(0)
    expect(mounted).toBeLessThan(40) // ~viewport + overscan, not 250
  })

  it('holds at RUNTIME_CAP under a long sustained stream (ring buffer, no growth)', () => {
    const t = setup()
    for (let second = 0; second < 20; second++) {
      t.emit(50) // 20s @ 50/s = 1000 events
      t.flush()
    }
    expect(t.store.getState().entries).toHaveLength(RUNTIME_CAP)
  })

  it('footer reports the entry count and the events/min rate', () => {
    const t = setup()
    t.emit(50)
    t.flush()
    expect(t.getByTestId('log-count')).toHaveTextContent('50 entries')
    expect(t.getByTestId('log-rate')).toHaveTextContent('50 events/min')

    // the rate is a trailing window: a minute later those arrivals have aged out
    t.advance(60_001)
    t.emit(1)
    t.flush()
    expect(t.getByTestId('log-rate')).toHaveTextContent('1 events/min')
  })
})

describe('LogView — pause holds scroll position (CD-407 AC)', () => {
  it('queues arrivals instead of appending, so the view never moves', () => {
    const t = setup()
    t.emit(100)
    t.flush()
    const scroller = t.getByTestId('log-scroll')
    const committed = t.store.getState().entries.length
    const firstRowText = t.rows()[0]?.textContent

    // scroll back through the history, then pause
    scroller.scrollTop = 60
    fireEvent.scroll(scroller)
    act(() => t.btn('log-pause').click())
    expect(t.btn('log-pause')).toHaveAttribute('aria-pressed', 'true')

    // a full second of new events arrives while paused
    t.emit(50)
    t.flush()

    expect(scroller.scrollTop).toBe(60) // held
    expect(t.store.getState().entries).toHaveLength(committed) // nothing appended
    expect(t.rows()[0]?.textContent).toBe(firstRowText) // same rows on screen
    expect(t.getByTestId('log-buffered')).toHaveTextContent('50 queued')
  })

  it('resume releases everything queued during the pause (no events lost)', () => {
    const t = setup()
    act(() => t.btn('log-pause').click())
    t.emit(30)
    t.flush()
    expect(t.store.getState().entries).toHaveLength(0)

    act(() => t.btn('log-pause').click()) // Resume
    t.flush()
    expect(t.store.getState().entries).toHaveLength(30)
    expect(t.queryByTestId('log-buffered')).toBeNull()
  })

  it('the paused queue is capped too — a long pause drops oldest, never grows', () => {
    const t = setup()
    act(() => t.btn('log-pause').click())
    t.emit(RUNTIME_CAP + 200)
    t.flush()
    expect(t.getByTestId('log-buffered')).toHaveTextContent(`${RUNTIME_CAP} queued`)
  })
})

describe('LogView — transport controls are wired (CD-407 AC: no dead controls)', () => {
  it('Step appends exactly one queued entry and is disabled when there is nothing to step', () => {
    const t = setup()
    expect(t.btn('log-step')).toBeDisabled() // live → stepping is meaningless
    expect(t.btn('log-step').title).toMatch(/Pause the stream to step/)

    act(() => t.btn('log-pause').click())
    expect(t.btn('log-step')).toBeDisabled() // paused but nothing queued yet
    expect(t.btn('log-step').title).toMatch(/No queued events/)

    t.emit(3)
    t.flush()
    expect(t.btn('log-step')).toBeEnabled()

    act(() => t.btn('log-step').click())
    expect(t.store.getState().entries).toHaveLength(1)
    expect(t.getByTestId('log-buffered')).toHaveTextContent('2 queued')

    act(() => t.btn('log-step').click())
    act(() => t.btn('log-step').click())
    expect(t.store.getState().entries).toHaveLength(3)
    expect(t.btn('log-step')).toBeDisabled() // drained
  })

  it('Step releases the queue in arrival order', () => {
    const t = setup()
    act(() => t.btn('log-pause').click())
    t.emit(1, { message: 'first' })
    t.emit(1, { message: 'second' })
    t.flush()

    act(() => t.btn('log-step').click())
    expect(t.store.getState().entries.map((e) => e.message)).toEqual(['first'])
    act(() => t.btn('log-step').click())
    expect(t.store.getState().entries.map((e) => e.message)).toEqual(['first', 'second'])
  })

  it('Clear empties the buffer, the queue and the rate', () => {
    const t = setup()
    t.emit(50)
    t.flush()
    expect(t.btn('log-clear')).toBeEnabled()

    act(() => t.btn('log-clear').click())
    expect(t.store.getState().entries).toHaveLength(0)
    expect(t.rows()).toHaveLength(0)
    expect(t.getByTestId('log-count')).toHaveTextContent('0 entries')
    expect(t.getByTestId('log-rate')).toHaveTextContent('0 events/min')
    expect(t.btn('log-clear')).toBeDisabled() // already empty → honestly disabled
    expect(t.btn('log-clear').title).toMatch(/already empty/)
  })
})

describe('LogView — filters', () => {
  it('level chips toggle their level out of the view', () => {
    const t = setup()
    t.emit(1, { level: 'error', message: 'boom' })
    t.emit(1, { level: 'debug', message: 'chatter' })
    t.flush()
    expect(t.rows()).toHaveLength(2)

    act(() => t.getByTestId('log-level-debug').click())
    expect(t.getByTestId('log-level-debug')).toHaveAttribute('aria-pressed', 'false')
    expect(t.rows()).toHaveLength(1)
    expect(t.rows()[0]).toHaveTextContent('boom')
    // the footer distinguishes filtered rows from what the buffer holds
    expect(t.getByTestId('log-count')).toHaveTextContent('1 of 2 entries')
  })

  it('the source filter offers the sources present and narrows to one', () => {
    const t = setup()
    t.emit(1, { source: 'flow', message: 'flow line' })
    t.emit(1, { source: 'device', message: 'device line' })
    t.flush()

    const select = t.getByTestId('log-source') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'device', 'flow'])

    fireEvent.change(select, { target: { value: 'device' } })
    expect(t.rows()).toHaveLength(1)
    expect(t.rows()[0]).toHaveTextContent('device line')

    fireEvent.change(select, { target: { value: '' } })
    expect(t.rows()).toHaveLength(2)
  })
})

describe('LogView — a11y', () => {
  it('labels the stream controls and the log region; the scroller is keyboard reachable', () => {
    const t = setup()
    expect(t.getByRole('group', { name: 'Stream controls' })).toBeInTheDocument()
    expect(t.getByRole('group', { name: 'Filter by level' })).toBeInTheDocument()
    expect(t.getByRole('list', { name: 'Execution log' })).toHaveAttribute('tabindex', '0')
  })

  it('unsubscribes from the feed on unmount (no stream leak)', () => {
    const feed = new MockRuntimeFeed()
    const unsub = vi.spyOn(feed, 'onLog')
    const { unmount } = renderWithProviders(<LogView feed={feed} store={createRuntimeStore()} />)
    expect(unsub).toHaveBeenCalledOnce()
    unmount()
    // the feed has no subscribers left: emitting reaches nobody and throws nothing
    expect(() => feed.emit()).not.toThrow()
  })
})
