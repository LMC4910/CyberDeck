import { describe, expect, it } from 'vitest'
import {
  PERF_METRICS,
  formatDuration,
  formatPercent,
  heatOf,
  timerRemainingPct,
} from './runtime-model'

describe('runtime-model — heat banding (CD-408)', () => {
  it('bands a counter into ok / warn / high at the thresholds', () => {
    expect(heatOf(0)).toBe('ok')
    expect(heatOf(59)).toBe('ok')
    expect(heatOf(60)).toBe('warn')
    expect(heatOf(84)).toBe('warn')
    expect(heatOf(85)).toBe('high')
    expect(heatOf(100)).toBe('high')
  })
})

describe('runtime-model — perf metrics', () => {
  it('lists the four counters in display order', () => {
    expect(PERF_METRICS.map((m) => m.key)).toEqual(['cpu', 'gpu', 'mem', 'exec'])
    for (const m of PERF_METRICS) expect(m.hint).toBeTruthy()
  })
})

describe('runtime-model — formatting', () => {
  it('rounds a counter to whole percent', () => {
    expect(formatPercent(42.4)).toBe('42%')
    expect(formatPercent(42.6)).toBe('43%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('formats a duration, clamping the over-due case to zero', () => {
    expect(formatDuration(500)).toBe('0.5s')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(15_000)).toBe('15.0s')
    expect(formatDuration(65_000)).toBe('1m 05s')
    expect(formatDuration(0)).toBe('0.0s')
    expect(formatDuration(-4000)).toBe('0.0s')
  })

  it('turns a timer countdown into a 0–100 meter width', () => {
    expect(timerRemainingPct(5000, 5000)).toBe(100)
    expect(timerRemainingPct(2500, 5000)).toBe(50)
    expect(timerRemainingPct(0, 5000)).toBe(0)
    expect(timerRemainingPct(-100, 5000)).toBe(0) // never negative
    expect(timerRemainingPct(100, 0)).toBe(0) // guards divide-by-zero
  })
})
