import { describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import { MockRuntimeFeed } from './runtime-feed'
import { Rails } from './rails'

/**
 * random 0.9 makes the flow simulation deterministic for the paths this suite
 * asserts: no ambient enqueue (0.9 ≥ 0.3), no early completion (0.9 ≥ 0.45), so a
 * timer's expiry is the only thing that moves the queue → running.
 */
function setup() {
  const feed = new MockRuntimeFeed({ random: () => 0.9 })
  const view = renderWithProviders(<Rails feed={feed} />)
  return {
    ...view,
    feed,
    step: (n = 1) =>
      act(() => {
        for (let i = 0; i < n; i++) feed.stepFlows()
      }),
    timerRows: () => view.getAllByTestId('timer-row'),
    runningRows: () => view.queryAllByTestId('running-row'),
  }
}

describe('Rails — live flow execution state (CD-408 AC: no frozen values)', () => {
  it('paints the seeded timers and honest empty rails on first render', () => {
    const t = setup()
    expect(t.timerRows()).toHaveLength(2)
    expect(t.getByTestId('rail-running-empty')).toHaveTextContent('No flows running')
    expect(t.getByTestId('rail-queue-empty')).toHaveTextContent('Queue empty')
    expect(t.getByTestId('rail-timers-count')).toHaveTextContent('2')
  })

  it('counts the timers down every step — the values are not fixture-frozen', () => {
    const t = setup()
    const before = t.timerRows()[1] // "Now Playing · every 5s", seeded at 5.0s
    expect(before).toHaveTextContent('5.0s')

    t.step()
    expect(t.timerRows()[1]).toHaveTextContent('4.0s') // moved

    t.step()
    expect(t.timerRows()[1]).toHaveTextContent('3.0s') // and keeps moving
  })

  it('promotes an expired timer through the queue into Running Flows', () => {
    const t = setup()
    expect(t.runningRows()).toHaveLength(0)

    t.step(5) // the 5s timer expires, enqueues, and drains into running
    const running = t.runningRows()
    expect(running).toHaveLength(1)
    expect(running[0]).toHaveTextContent('Now Playing')
    expect(t.getByTestId('rail-running-count')).toHaveTextContent('1')
    // the timer re-armed rather than sticking at zero
    expect(t.timerRows()[1]).toHaveTextContent('5.0s')
  })
})

describe('Rails — a11y + lifecycle', () => {
  it('labels each rail as a region and each timer as a meter', () => {
    const t = setup()
    expect(t.getByRole('region', { name: 'Running Flows' })).toBeInTheDocument()
    expect(t.getByRole('region', { name: 'Execution Queue' })).toBeInTheDocument()
    expect(t.getByRole('region', { name: 'Timers' })).toBeInTheDocument()

    const meters = t.getAllByRole('meter')
    expect(meters).toHaveLength(2)
    for (const m of meters) {
      expect(m).toHaveAttribute('aria-valuemin', '0')
      expect(m).toHaveAttribute('aria-valuenow')
    }
  })

  it('unsubscribes from the flow stream on unmount', () => {
    const feed = new MockRuntimeFeed()
    const spy = vi.spyOn(feed, 'onFlows')
    const { unmount } = renderWithProviders(<Rails feed={feed} />)
    expect(spy).toHaveBeenCalledOnce()
    unmount()
    expect(() => feed.stepFlows()).not.toThrow()
  })
})
