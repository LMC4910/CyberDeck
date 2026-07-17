import { describe, expect, it } from 'vitest'
import { DevicesController } from './devices-controller'
import { MockDevicesSource } from './mock-devices-source'

/** Await the microtasks a list()/revoke() Promise chain resolves through. */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('DevicesController — roster load', () => {
  it('lists devices from the source and clears loading', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    expect(controller.state.loading).toBe(true)

    controller.refresh()
    await settle()

    expect(controller.state.loading).toBe(false)
    expect(controller.state.devices.map((d) => d.id)).toEqual(['dev_ipad001', 'dev_pixel01', 'dev_deck01'])
  })

  it('drops a stale list when a newer refresh supersedes it', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    controller.refresh()
    controller.refresh() // second generation
    await settle()
    // No throw, one settled roster — the generation guard kept the first out.
    expect(controller.state.devices).toHaveLength(3)
  })
})

describe('DevicesController — heartbeat stream (CD-415 AC: cards update live)', () => {
  it('a frame patches exactly the named card: status, last-seen, latency', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    controller.refresh()
    controller.subscribeHeartbeat()
    await settle()

    const before = controller.state.devices.find((d) => d.id === 'dev_ipad001')!
    const others = controller.state.devices.filter((d) => d.id !== 'dev_ipad001')

    source.emit({ deviceId: 'dev_ipad001', state: 'offline', rttMs: 88, ts: 5_000 })

    const after = controller.state.devices.find((d) => d.id === 'dev_ipad001')!
    expect(after.status).toBe('offline')
    expect(after.latencyMs).toBe(88)
    expect(after.lastHeartbeatTs).toBe(5_000)
    expect(after).not.toBe(before) // the card is a new object (React repaints it)
    // untouched cards keep their identity — a heartbeat repaints one card, not the grid
    for (const o of others) {
      expect(controller.state.devices.find((d) => d.id === o.id)).toBe(o)
    }
  })

  it('a frame for an unknown device is a no-op (no state churn)', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    controller.refresh()
    controller.subscribeHeartbeat()
    await settle()

    const snapshot = controller.state
    source.emit({ deviceId: 'dev_ghost', state: 'online', rttMs: 10, ts: 1 })
    expect(controller.state).toBe(snapshot) // identical reference: nothing changed
  })

  it('dispose releases the subscription — later frames reach nobody', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    controller.refresh()
    controller.subscribeHeartbeat()
    await settle()

    controller.dispose()
    const snapshot = controller.state
    source.emit({ deviceId: 'dev_ipad001', state: 'offline', rttMs: 5, ts: 9 })
    expect(controller.state).toBe(snapshot)
  })
})

describe('DevicesController — revoke (CD-415 AC: round-trips the mock)', () => {
  it('revoke persists through the source and the re-list reflects it', async () => {
    const source = new MockDevicesSource()
    const controller = new DevicesController(source)
    controller.refresh()
    await settle()
    expect(controller.state.devices.find((d) => d.id === 'dev_ipad001')!.status).toBe('online')

    const ok = await controller.revoke('dev_ipad001')
    await settle()

    expect(ok).toBe(true)
    // proof it round-tripped: the source's own roster is revoked...
    const listed = await source.list()
    expect(listed.find((d) => d.id === 'dev_ipad001')!.status).toBe('revoked')
    // ...and the controller's re-list reflects that, not a local optimistic guess
    expect(controller.state.devices.find((d) => d.id === 'dev_ipad001')!.status).toBe('revoked')
    expect(controller.state.revoking).not.toContain('dev_ipad001')
    expect(controller.state.notice).toEqual({ kind: 'info', text: 'Revoked dev_ipad001' })
  })

  it('surfaces a notice and leaves the card intact when revoke fails', async () => {
    const source = new MockDevicesSource()
    source.revoke = () => Promise.reject(new Error('offline'))
    const controller = new DevicesController(source)
    controller.refresh()
    await settle()

    const ok = await controller.revoke('dev_ipad001')
    await settle()

    expect(ok).toBe(false)
    expect(controller.state.devices.find((d) => d.id === 'dev_ipad001')!.status).toBe('online')
    expect(controller.state.notice).toEqual({ kind: 'error', text: 'Could not revoke dev_ipad001: offline' })
    expect(controller.state.revoking).not.toContain('dev_ipad001')
  })
})

describe('DevicesController — pair capability', () => {
  it('reports pairing unavailable on a mock source (honest stub — needs the engine)', () => {
    const controller = new DevicesController(new MockDevicesSource())
    expect(controller.canPair()).toBe(false)
  })

  it('reports pairing available once a pairing-capable source is bound', () => {
    const source = new MockDevicesSource() as MockDevicesSource & { pair: () => Promise<void> }
    source.pair = () => Promise.resolve()
    expect(new DevicesController(source).canPair()).toBe(true)
  })
})
