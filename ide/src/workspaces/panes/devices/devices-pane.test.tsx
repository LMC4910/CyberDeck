import { describe, expect, it } from 'vitest'
import { act, fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '@/shared/test'
import DevicesPane from '../devices-pane'
import { DevicesSourceProvider } from './devices-source'
import { MockDevicesSource } from './mock-devices-source'

/** Render the pane over a caller-owned source so tests can emit / spy. */
function setup(source = new MockDevicesSource()) {
  const view = renderWithProviders(
    <DevicesSourceProvider value={source}>
      <DevicesPane />
    </DevicesSourceProvider>,
  )
  return {
    ...view,
    source,
    cards: () => view.container.querySelectorAll('[data-testid="device-card"]'),
    card: (id: string) => view.container.querySelector(`[data-device="${id}"]`) as HTMLElement,
  }
}

describe('DevicesPane — cards + status (CD-415)', () => {
  it('renders a card per device with name, class, resolution and status', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))

    const ipad = within(t.card('dev_ipad001'))
    expect(ipad.getByText('Studio iPad')).toBeInTheDocument()
    expect(ipad.getByTestId('device-class')).toHaveTextContent('iPad')
    expect(ipad.getByTestId('device-resolution')).toHaveTextContent('2360 × 1640')
    expect(ipad.getByTestId('device-status')).toHaveTextContent('Online')
    expect(ipad.getByTestId('device-latency')).toHaveTextContent('24 ms')
  })

  it('a heartbeat frame updates the matching card live (CD-415 AC)', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))
    expect(within(t.card('dev_ipad001')).getByTestId('device-status')).toHaveTextContent('Online')

    act(() => t.source.emit({ deviceId: 'dev_ipad001', state: 'offline', rttMs: 77, ts: 5_000 }))

    const ipad = within(t.card('dev_ipad001'))
    expect(ipad.getByTestId('device-status')).toHaveTextContent('Offline')
    expect(ipad.getByTestId('device-latency')).toHaveTextContent('77 ms')
    // the other cards did not change
    expect(within(t.card('dev_pixel01')).getByTestId('device-status')).toHaveTextContent('Online')
  })
})

describe('DevicesPane — revoke (CD-415 AC: confirm → round-trips the mock)', () => {
  it('confirming the dialog revokes the device and the card reflects it', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))

    fireEvent.click(within(t.card('dev_ipad001')).getByTestId('device-revoke'))
    expect(t.getByTestId('revoke-dialog')).toBeInTheDocument()

    await act(async () => {
      t.getByTestId('revoke-confirm').click()
    })

    await waitFor(() =>
      expect(within(t.card('dev_ipad001')).getByTestId('device-status')).toHaveTextContent('Revoked'),
    )
    // the source persisted it — a fresh list is revoked too (true round-trip)
    const listed = await t.source.list()
    expect(listed.find((d) => d.id === 'dev_ipad001')!.status).toBe('revoked')
    // a revoked card cannot be revoked again — the control is honestly disabled
    const revokeBtn = within(t.card('dev_ipad001')).getByTestId('device-revoke') as HTMLButtonElement
    expect(revokeBtn).toBeDisabled()
    expect(revokeBtn.title).toMatch(/already revoked/i)
  })

  it('cancelling the dialog leaves the device paired', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))

    fireEvent.click(within(t.card('dev_ipad001')).getByTestId('device-revoke'))
    act(() => t.getByTestId('revoke-cancel').click())

    expect(t.queryByTestId('revoke-dialog')).toBeNull()
    expect(within(t.card('dev_ipad001')).getByTestId('device-status')).toHaveTextContent('Online')
  })
})

describe('DevicesPane — pair-new honest stub (no dead control)', () => {
  it('disables "Pair New Device" with a stated reason on the mock source', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))

    const pair = t.getByTestId('pair-new') as HTMLButtonElement
    expect(pair).toBeDisabled()
    expect(pair.title).toMatch(/engine/i)
    expect(pair.title).toMatch(/M5/)
    // the reason is also on the page, tied to the control for AT
    expect(pair.getAttribute('aria-describedby')).toBe('dv-pair-reason')
    expect(t.getByTestId('pair-reason')).toHaveTextContent(/Pairing needs the engine/i)
  })
})

describe('DevicesPane — a11y', () => {
  it('labels the workspace, the grid and every actionable control', async () => {
    const t = setup()
    await waitFor(() => expect(t.cards()).toHaveLength(3))

    expect(t.getByRole('region', { name: 'Devices workspace' })).toBeInTheDocument()
    expect(t.getByRole('list', { name: 'Paired devices' })).toBeInTheDocument()
    // the revoke button carries the device name so it is unambiguous out of context
    expect(within(t.card('dev_ipad001')).getByRole('button', { name: 'Revoke Studio iPad' })).toBeInTheDocument()
  })
})
