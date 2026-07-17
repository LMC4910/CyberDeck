// Runtime panel model (CD-408) — the pure derivations behind the performance
// heat bars and the flow rails. Kept DOM-free so the "live, never frozen" ACs are
// provable as plain functions, the same way log-model.ts backs the log view.
import type { PerfSample } from './runtime-feed'

/** Heat banding for a 0–100 counter — drives the meter colour, not just its width. */
export type Heat = 'ok' | 'warn' | 'high'

export function heatOf(value: number): Heat {
  if (value >= 85) return 'high'
  if (value >= 60) return 'warn'
  return 'ok'
}

export interface PerfMetric {
  key: Exclude<keyof PerfSample, 'ts'>
  label: string
  /** Screen-reader hint on the meter (what this counter actually measures). */
  hint: string
}

/** The four counters the panel renders, in display order. */
export const PERF_METRICS: readonly PerfMetric[] = [
  { key: 'cpu', label: 'CPU', hint: 'processor load' },
  { key: 'gpu', label: 'GPU', hint: 'graphics load' },
  { key: 'mem', label: 'Memory', hint: 'memory in use' },
  { key: 'exec', label: 'Exec', hint: 'flow engine load' },
]

/** A 0–100 counter as a whole-percent label. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

/**
 * A duration for the timer rows: seconds with one decimal under a minute, m/s
 * above it. Clamped at 0 so an over-due countdown reads "0.0s", never negative.
 */
export function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms)
  if (clamped >= 60_000) {
    const m = Math.floor(clamped / 60_000)
    const s = Math.floor((clamped % 60_000) / 1000)
    return `${m}m ${s.toString().padStart(2, '0')}s`
  }
  return `${(clamped / 1000).toFixed(1)}s`
}

/** Fraction of a timer's interval still remaining, as a 0–100 meter width. */
export function timerRemainingPct(remainingMs: number, intervalMs: number): number {
  if (intervalMs <= 0) return 0
  return Math.max(0, Math.min(100, (remainingMs / intervalMs) * 100))
}
