// Log model (CD-407) — the pure derivations behind the log view: level/source
// filtering, the source list the filter offers, and the rolling events/min rate.
// Pure so the stream ACs are provable without a DOM.
import type { RuntimeLogEvent } from '@/shared/contract'

export type LogLevel = RuntimeLogEvent['level']

export const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']

/** `source` is optional on the wire (CD-114); bucket the unlabelled honestly. */
export const UNKNOWN_SOURCE = 'unknown'

export function sourceOf(entry: RuntimeLogEvent): string {
  return entry.source ?? UNKNOWN_SOURCE
}

export interface LogFilter {
  levels: ReadonlySet<LogLevel>
  /** null = every source. */
  source: string | null
}

export function allLevels(): Set<LogLevel> {
  return new Set(LOG_LEVELS)
}

export function filterEntries(
  entries: readonly RuntimeLogEvent[],
  filter: LogFilter,
): RuntimeLogEvent[] {
  return entries.filter(
    (e) => filter.levels.has(e.level) && (filter.source === null || sourceOf(e) === filter.source),
  )
}

/** Distinct sources present in the buffer, sorted — the source filter's options. */
export function sourcesOf(entries: readonly RuntimeLogEvent[]): string[] {
  const seen = new Set<string>()
  for (const e of entries) seen.add(sourceOf(e))
  return [...seen].sort()
}

export const RATE_WINDOW_MS = 60_000

/**
 * Events/min = how many arrivals landed in the trailing window. Counting arrivals
 * (not entry.ts) keeps the footer honest about stream throughput even while the
 * view is paused, and lets the rate decay to 0 when the stream goes quiet.
 */
export function eventsPerMinute(
  arrivals: readonly number[],
  now: number,
  windowMs = RATE_WINDOW_MS,
): number {
  const cutoff = now - windowMs
  let count = 0
  for (let i = arrivals.length - 1; i >= 0; i--) {
    const at = arrivals[i]
    if (at === undefined || at <= cutoff) break // ascending → everything older is out
    count++
  }
  return count
}

/** Drop arrivals that have aged out of the window (keeps the ref bounded). */
export function trimArrivals(
  arrivals: readonly number[],
  now: number,
  windowMs = RATE_WINDOW_MS,
): number[] {
  const cutoff = now - windowMs
  const firstLive = arrivals.findIndex((at) => at > cutoff)
  if (firstLive === -1) return [] // everything aged out
  return firstLive === 0 ? [...arrivals] : arrivals.slice(firstLive)
}
