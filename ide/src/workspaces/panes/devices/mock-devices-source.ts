// In-memory Devices source (CD-415) — the fallback the pane runs on until the shell
// binds a DevicesRepository adapter. It holds a small roster of paired devices, emits
// heartbeat frames (deterministic LCG + injectable scheduler, the CD-407 precedent),
// and persists revokes so `list()` round-trips them. `pair` is intentionally NOT
// implemented: pairing needs the engine (M5), so the pane keeps that control an
// honest disabled stub.
import type { DeviceHeartbeatEvent } from '@/shared/contract'
import type { DeviceRecord, DevicesSource } from './devices-source'

export interface MockDevicesSourceOptions {
  /** Injected RNG (0..1) — default is a deterministic LCG so runs are repeatable. */
  random?: () => number
  /** Heartbeat cadence when auto-running. */
  intervalMs?: number
  schedule?: (fn: () => void, ms: number) => number
  cancel?: (handle: number) => void
  now?: () => number
}

/** The seed roster — the three device classes the player preview targets (CD-417). */
const SEED: readonly DeviceRecord[] = [
  {
    id: 'dev_ipad001',
    name: 'Studio iPad',
    deviceClass: 'ipad',
    resolution: { width: 2360, height: 1640 },
    status: 'online',
    lastHeartbeatTs: 0,
    latencyMs: 24,
  },
  {
    id: 'dev_pixel01',
    name: 'Pixel Tablet',
    deviceClass: 'pixel',
    resolution: { width: 2560, height: 1600 },
    status: 'online',
    lastHeartbeatTs: 0,
    latencyMs: 41,
  },
  {
    id: 'dev_deck01',
    name: 'Deck Mini',
    deviceClass: 'deck-mini',
    resolution: { width: 1280, height: 800 },
    status: 'offline',
  },
]

export class MockDevicesSource implements DevicesSource {
  private readonly handlers = new Set<(e: DeviceHeartbeatEvent) => void>()
  private readonly options: Required<MockDevicesSourceOptions>
  private devices: DeviceRecord[]
  private seed = 1
  private cursor = 0

  constructor(options: MockDevicesSourceOptions = {}) {
    this.devices = SEED.map((d) => ({ ...d, resolution: { ...d.resolution } }))
    this.options = {
      random: options.random ?? (() => this.lcg()),
      intervalMs: options.intervalMs ?? 1_500,
      schedule: options.schedule ?? ((fn, ms) => setInterval(fn, ms) as unknown as number),
      cancel: options.cancel ?? ((h) => clearInterval(h)),
      now: options.now ?? (() => Date.now()),
    }
  }

  list(): Promise<DeviceRecord[]> {
    // Hand back copies so a subscriber patching a card never mutates our roster.
    return Promise.resolve(this.devices.map((d) => ({ ...d, resolution: { ...d.resolution } })))
  }

  revoke(id: string): Promise<void> {
    // Persisted: a later list() shows the revoked status — the round-trip proof.
    this.devices = this.devices.map((d) => (d.id === id ? { ...d, status: 'revoked' } : d))
    this.emit({ deviceId: id, state: 'revoked', ts: this.options.now() })
    return Promise.resolve()
  }

  onHeartbeat(handler: (e: DeviceHeartbeatEvent) => void): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  /** Begin emitting heartbeats; returns a stop. Skipped under test (emit by hand). */
  start(): () => void {
    const handle = this.options.schedule(() => this.tick(), this.options.intervalMs)
    return () => this.options.cancel(handle)
  }

  /** One heartbeat from the next live (non-revoked) device, with jittered latency. */
  tick(): DeviceHeartbeatEvent | undefined {
    const live = this.devices.filter((d) => d.status !== 'revoked')
    if (live.length === 0) return undefined
    const device = live[this.cursor++ % live.length]!
    const rttMs = 12 + Math.round(this.options.random() * 60)
    // An offline device coming back online (and vice-versa, rarely) keeps it lively.
    const state = this.options.random() < 0.12 ? 'offline' : 'online'
    const event: DeviceHeartbeatEvent = { deviceId: device.id, state, rttMs, ts: this.options.now() }
    this.emit(event)
    return event
  }

  /** Emit a frame to every subscriber (also the test hand-crank). */
  emit(event: DeviceHeartbeatEvent): void {
    // Keep our own roster consistent with what subscribers see.
    this.devices = this.devices.map((d) =>
      d.id === event.deviceId
        ? { ...d, status: event.state, lastHeartbeatTs: event.ts, latencyMs: event.rttMs ?? d.latencyMs }
        : d,
    )
    for (const h of this.handlers) h(event)
  }

  /** Deterministic RNG (the same generator the CD-326/407 mocks use). */
  private lcg(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }
}
