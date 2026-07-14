import { describe, expect, it, vi } from 'vitest'
import { EventBus, TypedEventBus } from '@/platform/eventbus'
import {
  MockApiGateway,
  MockStreamSource,
  selectGateway,
  OfflineGateway,
  RepositoryRegistry,
  type GatewayMode,
} from '@/repositories'
import type { VariableChangedEvent } from '@/shared/contract'

describe('MockStreamSource — push streams', () => {
  it('delivers ticked events to a subscription', () => {
    const streams = new MockStreamSource({ random: () => 0.5 })
    const seen: VariableChangedEvent[] = []
    streams.subscribe('variables.subscribe', undefined, (e) => seen.push(e as VariableChangedEvent))
    streams.tick()
    streams.tick()
    expect(seen).toHaveLength(2)
    expect(seen[0]?.id).toBe('sys.cpu.load')
  })

  it('auto-ticks via the injected scheduler', () => {
    let fire: (() => void) | undefined
    const scheduler = (fn: () => void) => {
      fire = fn
      return () => {}
    }
    const streams = new MockStreamSource({ scheduler, intervalMs: 100, random: () => 0 })
    const seen: unknown[] = []
    streams.subscribe('runtime.log', undefined, (e) => seen.push(e))
    fire?.()
    expect(seen).toHaveLength(1)
  })

  it('unsubscribe stops delivery', () => {
    const streams = new MockStreamSource()
    const cb = vi.fn()
    const off = streams.subscribe('devices.heartbeat', undefined, cb)
    off()
    streams.tick()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('mock streams → repo subscription → bus (visible via tap)', () => {
  it('a variable tick reaches the EventBus and its tap', () => {
    const gw = new MockApiGateway()
    const repos = new RepositoryRegistry(gw)
    const bus = new EventBus({ schedule: (fn) => fn() }) // sync delivery for the test
    const typed = new TypedEventBus(bus)

    const tapped: string[] = []
    bus.tap((e) => tapped.push(e.topic))

    // wiring: repo subscription re-emits onto the bus
    repos.variables.onChanged((e) => typed.emit('VariableChanged', e))
    gw.streamSource.tick()

    expect(tapped).toContain('VariableChanged')
  })
})

describe('gateway selection — mock ↔ engine ↔ offline flip', () => {
  it('selects the mock gateway', () => {
    const { mode, gateway } = selectGateway('mock')
    expect(mode).toBe('mock')
    expect(gateway).toBeInstanceOf(MockApiGateway)
  })

  it('selects the offline gateway', () => {
    const { gateway } = selectGateway('offline')
    expect(gateway).toBeInstanceOf(OfflineGateway)
  })

  it('engine selection without a factory throws a clear error (until M5)', () => {
    expect(() => selectGateway('engine')).toThrow(/not available until M5/)
  })

  it('engine selection uses the injected factory when provided', () => {
    const fake = new OfflineGateway()
    const { gateway } = selectGateway('engine', { engineFactory: () => fake })
    expect(gateway).toBe(fake)
  })

  it('flipping mode returns a different gateway instance', () => {
    const modes: GatewayMode[] = ['mock', 'offline']
    const gateways = modes.map((m) => selectGateway(m).gateway)
    expect(gateways[0]).not.toBe(gateways[1])
  })
})

describe('OfflineGateway — degrades, does not break', () => {
  it('reads return an empty result set (banner state, not a throw)', async () => {
    const gw = new OfflineGateway()
    const page = await gw.request<{ items: unknown[]; total: number }>('projects.list')
    expect(page).toEqual({ items: [], page: 1, limit: 50, total: 0 })
  })

  it('mutations soft-fail as retryable (queue + retry when back online)', async () => {
    const gw = new OfflineGateway()
    await expect(gw.request('projects.create', { body: {} })).rejects.toMatchObject({
      code: 'unavailable',
      retryable: true,
    })
  })

  it('repositories over the offline gateway list empty without crashing', async () => {
    const repos = new RepositoryRegistry(new OfflineGateway())
    const page = await repos.projects.query()
    expect(page.items).toEqual([])
  })
})
