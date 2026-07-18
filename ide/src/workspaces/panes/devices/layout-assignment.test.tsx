import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MockDevicesSource } from './mock-devices-source'
import { DevicesController } from './devices-controller'
import { DeviceCard } from './device-card'
import type { DeviceRecord } from './devices-source'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('layout assignment (CD-418)', () => {
  it('mock persists an assignment so list() round-trips it (AC: assignment persists)', async () => {
    const source = new MockDevicesSource()
    await source.assignLayout('dev_ipad001', 'pg_home0001')
    const list = await source.list()
    expect(list.find((d) => d.id === 'dev_ipad001')?.assignedPageId).toBe('pg_home0001')
  })

  it('controller.assign round-trips through the source and reflects it in state', async () => {
    const controller = new DevicesController(new MockDevicesSource())
    controller.refresh()
    await flush()
    expect(await controller.assign('dev_pixel01', 'pg_scene0001')).toBe(true)
    await flush()
    const device = controller.state.devices.find((d) => d.id === 'dev_pixel01')
    expect(device?.assignedPageId).toBe('pg_scene0001')
    expect(controller.state.notice?.kind).toBe('info')
  })

  it('the card exposes an assign select that reports the chosen page', () => {
    const device: DeviceRecord = {
      id: 'dev_ipad001',
      name: 'Studio iPad',
      deviceClass: 'ipad',
      resolution: { width: 2360, height: 1640 },
      status: 'online',
    }
    const onAssign = vi.fn()
    render(
      <ul>
        <DeviceCard
          device={device}
          revoking={false}
          now={0}
          onRevoke={() => {}}
          pages={[
            { id: 'pg_home0001', label: 'Home' },
            { id: 'pg_scene0001', label: 'Scenes' },
          ]}
          onAssign={onAssign}
        />
      </ul>,
    )
    fireEvent.change(screen.getByLabelText(/assign layout to studio ipad/i), { target: { value: 'pg_scene0001' } })
    expect(onAssign).toHaveBeenCalledWith('pg_scene0001')
  })

  it('reflects an already-assigned page as the select value', () => {
    const device: DeviceRecord = {
      id: 'dev_ipad001',
      name: 'Studio iPad',
      deviceClass: 'ipad',
      resolution: { width: 2360, height: 1640 },
      status: 'online',
      assignedPageId: 'pg_scene0001',
    }
    render(
      <ul>
        <DeviceCard
          device={device}
          revoking={false}
          now={0}
          onRevoke={() => {}}
          pages={[
            { id: 'pg_home0001', label: 'Home' },
            { id: 'pg_scene0001', label: 'Scenes' },
          ]}
          onAssign={() => {}}
        />
      </ul>,
    )
    expect((screen.getByLabelText(/assign layout to studio ipad/i) as HTMLSelectElement).value).toBe('pg_scene0001')
  })
})
