// Runtime feed (CD-407) — the seam the Runtime workspace reads its live data
// through. `src/workspaces/**` may not import repositories (ide/README.md boundary
// matrix), so the shell injects a feed at assembly and the pane never learns where
// the events came from; the M5 engine swap replaces the implementation, not this
// interface. Until the shell wires one, the pane falls back to the mock feed below
// — the precedent CD-326 set for the variable stream.
import type { RuntimeLogEvent } from '@/shared/contract'

export interface RuntimeFeed {
  /** Subscribe to log entries as they stream in; returns an unsubscribe. */
  onLog(handler: (entry: RuntimeLogEvent) => void): () => void
  /** Begin emitting; returns a stop. A shell-injected feed may make this a no-op. */
  start(): () => void
}

export interface MockRuntimeFeedOptions {
  /** Events per second. The AC's sustained load is 50. */
  rate?: number
  /** Emit cadence; each tick releases the events accrued since the last one. */
  tickMs?: number
  /** Injected RNG (0..1) — default is a deterministic LCG, so runs are repeatable. */
  random?: () => number
  schedule?: (fn: () => void, ms: number) => number
  cancel?: (handle: number) => void
  now?: () => number
}

/** Weighted so the stream reads like a real deck: mostly chatter, rare failures. */
const LEVEL_WEIGHTS: readonly (readonly [RuntimeLogEvent['level'], number])[] = [
  ['debug', 0.34],
  ['info', 0.5],
  ['warn', 0.12],
  ['error', 0.04],
]

export const MOCK_SOURCES = ['flow', 'engine', 'device', 'variable'] as const

const MESSAGES: Record<string, readonly string[]> = {
  flow: ['node "Set Scene" ok', 'branch T taken', 'flow "Stream Start" completed', 'trigger fired'],
  engine: ['tick budget 4.1 ms', 'gc pause 0.8 ms', 'reconnected to control plane', 'queue drained'],
  device: ['heartbeat dev_ipad001', 'layout push ack', 'touch dispatch 12 ms', 'wifi rssi -61 dBm'],
  variable: ['sys.cpu.load → 42', 'fps.current → 144', 'audio.volume → 0.8', 'media.title changed'],
}

/**
 * A mock runtime stream (CD-407). Emits log entries at a configurable rate; the
 * default LCG + injectable scheduler make it deterministic under test, where
 * `emit()` drives entries by hand instead of by clock.
 */
export class MockRuntimeFeed implements RuntimeFeed {
  private readonly logHandlers = new Set<(entry: RuntimeLogEvent) => void>()
  private readonly options: Required<MockRuntimeFeedOptions>
  private seed = 1
  private counter = 0
  /** Fractional events carried between ticks so the rate stays exact over time. */
  private owed = 0

  constructor(options: MockRuntimeFeedOptions = {}) {
    this.options = {
      rate: options.rate ?? 50,
      tickMs: options.tickMs ?? 50,
      random: options.random ?? (() => this.lcg()),
      schedule: options.schedule ?? ((fn, ms) => setInterval(fn, ms) as unknown as number),
      cancel: options.cancel ?? ((h) => clearInterval(h)),
      now: options.now ?? (() => Date.now()),
    }
  }

  onLog(handler: (entry: RuntimeLogEvent) => void): () => void {
    this.logHandlers.add(handler)
    return () => {
      this.logHandlers.delete(handler)
    }
  }

  start(): () => void {
    const { schedule, cancel, tickMs, rate } = this.options
    const handle = schedule(() => {
      this.owed += (rate * tickMs) / 1000
      const n = Math.floor(this.owed)
      this.owed -= n
      for (let i = 0; i < n; i++) this.emit()
    }, tickMs)
    return () => cancel(handle)
  }

  /** Emit one entry (generated unless `entry` overrides it). */
  emit(entry?: Partial<RuntimeLogEvent>): RuntimeLogEvent {
    const next = { ...this.generate(), ...entry }
    for (const h of this.logHandlers) h(next)
    return next
  }

  private generate(): RuntimeLogEvent {
    const source = MOCK_SOURCES[Math.floor(this.options.random() * MOCK_SOURCES.length)] ?? 'engine'
    const pool = MESSAGES[source] ?? ['event']
    const message = pool[Math.floor(this.options.random() * pool.length)] ?? 'event'
    this.counter++
    return {
      level: this.pickLevel(),
      message: `#${this.counter} ${message}`,
      source,
      ts: this.options.now(),
    }
  }

  private pickLevel(): RuntimeLogEvent['level'] {
    let roll = this.options.random()
    for (const [level, weight] of LEVEL_WEIGHTS) {
      roll -= weight
      if (roll <= 0) return level
    }
    return 'info'
  }

  /** Deterministic RNG (same generator the CD-326 mock ticks use). */
  private lcg(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }
}
