// Runtime feed (CD-407) — the seam the Runtime workspace reads its live data
// through. `src/workspaces/**` may not import repositories (ide/README.md boundary
// matrix), so the shell injects a feed at assembly and the pane never learns where
// the events came from; the M5 engine swap replaces the implementation, not this
// interface. Until the shell wires one, the pane falls back to the mock feed below
// — the precedent CD-326 set for the variable stream.
import type { RuntimeLogEvent } from '@/shared/contract'

/** One sample of the engine's performance counters (CD-408 heat bars), 0–100. */
export interface PerfSample {
  cpu: number
  gpu: number
  mem: number
  /** Execution heat: how hard the flow engine is working. */
  exec: number
  ts: number
}

export interface RunningFlow {
  id: string
  name: string
  /** The node the walk is currently on. */
  node: string
  startedAt: number
}

export interface QueuedRun {
  id: string
  flow: string
  trigger: string
}

export interface TimerRow {
  id: string
  label: string
  remainingMs: number
  intervalMs: number
}

/** What the rails render: the flow engine's live execution state. */
export interface FlowRuntimeState {
  running: RunningFlow[]
  queued: QueuedRun[]
  timers: TimerRow[]
}

export interface RuntimeFeed {
  /** Subscribe to log entries as they stream in; returns an unsubscribe. */
  onLog(handler: (entry: RuntimeLogEvent) => void): () => void
  /** Subscribe to performance counter samples. */
  onPerf(handler: (sample: PerfSample) => void): () => void
  /** Subscribe to flow execution state (running / queued / timers). */
  onFlows(handler: (state: FlowRuntimeState) => void): () => void
  /** The current flow state, for first paint before the first push lands. */
  flows(): FlowRuntimeState
  /** Begin emitting; returns a stop. A shell-injected feed may make this a no-op. */
  start(): () => void
}

export interface MockRuntimeFeedOptions {
  /** Events per second. The AC's sustained load is 50. */
  rate?: number
  /** Emit cadence; each tick releases the events accrued since the last one. */
  tickMs?: number
  /** Performance counters sample every this many ms. */
  perfEveryMs?: number
  /** The flow engine advances every this many ms. */
  flowEveryMs?: number
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

const FLOW_NAMES = ['Stream Start', 'Scene Swap', 'Mic Mute', 'Now Playing'] as const
const FLOW_NODES = ['Set Scene', 'HTTP Request', 'Delay', 'Set Variable', 'Notify'] as const
const TRIGGERS = ['timer', 'tap', 'variable change', 'device'] as const

/** Where the perf random-walk starts; every sample walks on from here. */
const PERF_SEED: Omit<PerfSample, 'ts'> = { cpu: 42, gpu: 63, mem: 71, exec: 18 }

/**
 * A mock runtime stream (CD-407/408). Emits log entries at a configurable rate,
 * performance counters as a random walk, and a small flow-engine simulation for
 * the rails. The default LCG + injectable scheduler make it deterministic under
 * test, where `emit()`/`tick()` drive it by hand instead of by clock.
 */
export class MockRuntimeFeed implements RuntimeFeed {
  private readonly logHandlers = new Set<(entry: RuntimeLogEvent) => void>()
  private readonly perfHandlers = new Set<(sample: PerfSample) => void>()
  private readonly flowHandlers = new Set<(state: FlowRuntimeState) => void>()
  private readonly options: Required<MockRuntimeFeedOptions>
  private seed = 1
  private counter = 0
  private runId = 0
  /** Fractional events carried between ticks so the rate stays exact over time. */
  private owed = 0
  private elapsed = 0
  private perf = { ...PERF_SEED }
  private flowState: FlowRuntimeState = {
    running: [],
    queued: [],
    timers: [
      { id: 'tmr_1', label: 'Stream Start · every 15s', remainingMs: 15_000, intervalMs: 15_000 },
      { id: 'tmr_2', label: 'Now Playing · every 5s', remainingMs: 5_000, intervalMs: 5_000 },
    ],
  }

  constructor(options: MockRuntimeFeedOptions = {}) {
    this.options = {
      rate: options.rate ?? 50,
      tickMs: options.tickMs ?? 50,
      perfEveryMs: options.perfEveryMs ?? 500,
      flowEveryMs: options.flowEveryMs ?? 1_000,
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

  onPerf(handler: (sample: PerfSample) => void): () => void {
    this.perfHandlers.add(handler)
    return () => {
      this.perfHandlers.delete(handler)
    }
  }

  onFlows(handler: (state: FlowRuntimeState) => void): () => void {
    this.flowHandlers.add(handler)
    return () => {
      this.flowHandlers.delete(handler)
    }
  }

  flows(): FlowRuntimeState {
    return this.flowState
  }

  start(): () => void {
    const { schedule, cancel, tickMs } = this.options
    const handle = schedule(() => this.tick(), tickMs)
    return () => cancel(handle)
  }

  /** Advance the simulation by one tick (the scheduler's, or a test's by hand). */
  tick(): void {
    const { tickMs, rate, perfEveryMs, flowEveryMs } = this.options
    const before = this.elapsed
    this.elapsed += tickMs

    this.owed += (rate * tickMs) / 1000
    const n = Math.floor(this.owed)
    this.owed -= n
    for (let i = 0; i < n; i++) this.emit()

    if (Math.floor(before / perfEveryMs) !== Math.floor(this.elapsed / perfEveryMs)) this.emitPerf()
    if (Math.floor(before / flowEveryMs) !== Math.floor(this.elapsed / flowEveryMs)) this.stepFlows(flowEveryMs)
  }

  /** Sample the counters: a bounded random walk, never a frozen fixture. */
  emitPerf(): PerfSample {
    const walk = (v: number, spread: number) =>
      Math.max(0, Math.min(100, Math.round(v + (this.options.random() * 2 - 1) * spread)))
    this.perf = {
      cpu: walk(this.perf.cpu, 8),
      gpu: walk(this.perf.gpu, 10),
      mem: walk(this.perf.mem, 3),
      // exec heat tracks how much the flow engine is actually doing
      exec: walk(10 + this.flowState.running.length * 22, 6),
    }
    const sample: PerfSample = { ...this.perf, ts: this.options.now() }
    for (const h of this.perfHandlers) h(sample)
    return sample
  }

  /** One step of the flow engine: timers fire → queue → running → completion. */
  stepFlows(deltaMs = this.options.flowEveryMs): FlowRuntimeState {
    const queued = [...this.flowState.queued]

    // 1. timers count down; an expired timer re-arms and enqueues its run
    const timers = this.flowState.timers.map((t) => {
      const remainingMs = t.remainingMs - deltaMs
      if (remainingMs > 0) return { ...t, remainingMs }
      const flow = t.label.split(' · ')[0] ?? FLOW_NAMES[0]
      queued.push({ id: `run_${++this.runId}`, flow, trigger: 'timer' })
      return { ...t, remainingMs: t.intervalMs }
    })

    // 2. running flows advance a node, then finish
    const running: RunningFlow[] = []
    for (const r of this.flowState.running) {
      if (this.options.random() < 0.45) {
        this.emit({ level: 'info', message: `flow "${r.name}" completed`, source: 'flow' })
        continue
      }
      running.push({ ...r, node: this.pick(FLOW_NODES) })
    }

    // 3. the queue drains into the running set, up to the engine's concurrency
    while (running.length < 3 && queued.length > 0) {
      const next = queued.shift()
      if (!next) break
      running.push({ id: next.id, name: next.flow, node: FLOW_NODES[0], startedAt: this.options.now() })
    }

    // 4. ambient traffic: an occasional ad-hoc run lands in the queue
    if (this.options.random() < 0.3) {
      queued.push({ id: `run_${++this.runId}`, flow: this.pick(FLOW_NAMES), trigger: this.pick(TRIGGERS) })
    }

    this.flowState = { running, queued, timers }
    for (const h of this.flowHandlers) h(this.flowState)
    return this.flowState
  }

  /** Emit one entry (generated unless `entry` overrides it). */
  emit(entry?: Partial<RuntimeLogEvent>): RuntimeLogEvent {
    const next = { ...this.generate(), ...entry }
    for (const h of this.logHandlers) h(next)
    return next
  }

  private pick<T>(pool: readonly T[]): T {
    return pool[Math.floor(this.options.random() * pool.length)] ?? (pool[0] as T)
  }

  private generate(): RuntimeLogEvent {
    const source = this.pick(MOCK_SOURCES)
    const pool = MESSAGES[source] ?? ['event']
    const message = this.pick(pool)
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
