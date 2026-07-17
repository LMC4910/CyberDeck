import { describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import type { PerfSample } from './runtime-feed'
import { MockRuntimeFeed } from './runtime-feed'
import { PerfPanel } from './perf-panel'
import { heatOf } from './runtime-model'

/** Emit one perf sample the way the pane's clock would, returning it for asserts. */
function pump(feed: MockRuntimeFeed): PerfSample {
  let sample!: PerfSample
  act(() => {
    sample = feed.emitPerf()
  })
  return sample
}

describe('PerfPanel — live from the perf stream (CD-408 AC: no frozen values)', () => {
  it('renders an awaiting state until the first sample lands', () => {
    const feed = new MockRuntimeFeed()
    const t = renderWithProviders(<PerfPanel feed={feed} />)
    expect(t.getByTestId('perf-awaiting')).toBeInTheDocument()
    expect(t.getByTestId('perf-cpu-value')).toHaveTextContent('—')
    // meters exist but carry no value yet
    expect(t.getByLabelText('CPU processor load')).not.toHaveAttribute('aria-valuenow')
  })

  it('moves the bars with the stream — up then down, never stuck on one sample', () => {
    // emitPerf() draws one random per counter (cpu, gpu, mem, exec) — 4 per sample.
    // random 1 → +spread (up), 0 → −spread (down). Feed a whole sample of ups then a
    // whole sample of downs so cpu climbs on sample 1 and falls on sample 2.
    const feed = new MockRuntimeFeed({ random: (() => {
      const values = [1, 1, 1, 1, 0, 0, 0, 0]
      let i = 0
      return () => values[i++ % values.length] as number
    })() })
    const t = renderWithProviders(<PerfPanel feed={feed} />)

    const a = pump(feed)
    expect(t.queryByTestId('perf-awaiting')).toBeNull()
    expect(t.getByTestId('perf-cpu-value')).toHaveTextContent(`${a.cpu}%`)
    const cpuMeter = t.getByLabelText('CPU processor load')
    expect(cpuMeter).toHaveAttribute('aria-valuenow', String(a.cpu))

    const b = pump(feed)
    // the walk with random 0 pulls the counters down: the panel reflects the NEW
    // sample, proving it is not frozen on the first one.
    expect(b.cpu).toBeLessThan(a.cpu)
    expect(t.getByTestId('perf-cpu-value')).toHaveTextContent(`${b.cpu}%`)
    expect(cpuMeter).toHaveAttribute('aria-valuenow', String(b.cpu))
  })

  it('colours each fill by the heat band of the value it is showing', () => {
    const feed = new MockRuntimeFeed()
    const t = renderWithProviders(<PerfPanel feed={feed} />)
    const sample = pump(feed)
    for (const key of ['cpu', 'gpu', 'mem', 'exec'] as const) {
      const fill = t.getByTestId(`perf-${key}`).querySelector('.rt-meter-fill')
      expect(fill).toHaveAttribute('data-heat', heatOf(sample[key]))
    }
  })
})

describe('PerfPanel — a11y + lifecycle', () => {
  it('exposes each counter as a labelled meter with min/max', () => {
    const feed = new MockRuntimeFeed()
    const t = renderWithProviders(<PerfPanel feed={feed} />)
    const meters = t.getAllByRole('meter')
    expect(meters).toHaveLength(4)
    for (const m of meters) {
      expect(m).toHaveAttribute('aria-valuemin', '0')
      expect(m).toHaveAttribute('aria-valuemax', '100')
    }
    expect(t.getByLabelText('Exec flow engine load')).toBeInTheDocument()
  })

  it('unsubscribes from the perf stream on unmount', () => {
    const feed = new MockRuntimeFeed()
    const spy = vi.spyOn(feed, 'onPerf')
    const { unmount } = renderWithProviders(<PerfPanel feed={feed} />)
    expect(spy).toHaveBeenCalledOnce()
    unmount()
    expect(() => feed.emitPerf()).not.toThrow()
  })
})
