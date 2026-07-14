// Mock push streams (CD-128). Drives the subscription routes — variable ticks,
// runtime log lines, device heartbeats — so repo `subscribe()` calls receive live
// events (which the wiring layer re-emits onto the EventBus). Ticks come from an
// injected scheduler or a manual `tick()` for deterministic tests.
import type {
  VariableChangedEvent,
  RuntimeLogEvent,
  DeviceHeartbeatEvent,
} from '@/shared/contract'

type Handler = (event: unknown) => void

export interface MockStreamOptions {
  /** Injected RNG for value jitter (0..1). Default Math.random. */
  random?: () => number
  /** Auto-tick interval scheduler; omit for manual `tick()` only. */
  scheduler?: (fn: () => void, ms: number) => () => void
  intervalMs?: number
}

interface Subscription {
  route: string
  params?: Record<string, unknown>
  handler: Handler
}

export class MockStreamSource {
  private readonly subs = new Set<Subscription>()
  private readonly random: () => number
  private stopAuto?: () => void
  private counter = 0

  constructor(options: MockStreamOptions = {}) {
    this.random = options.random ?? Math.random
    if (options.scheduler && options.intervalMs) {
      this.stopAuto = options.scheduler(() => this.tick(), options.intervalMs)
    }
  }

  subscribe(route: string, params: Record<string, unknown> | undefined, handler: Handler): () => void {
    const sub: Subscription = { route, params, handler }
    this.subs.add(sub)
    return () => {
      this.subs.delete(sub)
    }
  }

  /** Emit one event to every matching subscription. */
  tick(): void {
    this.counter++
    for (const sub of this.subs) sub.handler(this.eventFor(sub.route))
  }

  stop(): void {
    this.stopAuto?.()
    this.subs.clear()
  }

  private eventFor(route: string): unknown {
    const ts = this.counter
    if (route === 'variables.subscribe') {
      const event: VariableChangedEvent = {
        id: 'sys.cpu.load',
        value: Math.round(this.random() * 100),
        ts,
      }
      return event
    }
    if (route === 'runtime.log') {
      const event: RuntimeLogEvent = { level: 'info', message: `tick ${ts}`, ts }
      return event
    }
    if (route === 'devices.heartbeat') {
      const event: DeviceHeartbeatEvent = { deviceId: 'dev_ipad001', state: 'online', ts }
      return event
    }
    return { ts }
  }
}
