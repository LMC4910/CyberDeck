// Devices workspace (CD-415). A grid of device cards driven by one DevicesSource
// (devices/devices-source.ts): name/class/resolution/status/heartbeat/latency, live
// off the heartbeat stream, with revoke (confirm → round-trips the mock). The
// workspace may not import repositories, so the shell binds a DevicesRepository
// adapter through DevicesSourceProvider; until it does, the pane serves the in-memory
// mock — the same M4/M5 swap the runtime feed (CD-407) set up.
//
// "Pair New Device" is an honest disabled stub: the real pairing handshake needs the
// engine (M5, CD-417/418), so the control states its reason rather than pretending.
import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '@/shared/a11y'
import { DeviceCard } from './devices/device-card'
import { MockDevicesSource } from './devices/mock-devices-source'
import { useDevicesSourceOptional, type DeviceRecord } from './devices/devices-source'
import { useDevicesController, useDevicesState } from './devices/use-devices'
import './devices/devices.css'

const PAIR_DISABLED_REASON = 'Pairing needs the engine — it arrives in M5'

export default function DevicesPane() {
  const provided = useDevicesSourceOptional()
  const [fallback] = useState(() => new MockDevicesSource())
  const source = provided ?? fallback
  const controller = useDevicesController(source)

  const devices = useDevicesState(controller, (s) => s.devices)
  const loading = useDevicesState(controller, (s) => s.loading)
  const revoking = useDevicesState(controller, (s) => s.revoking)
  const notice = useDevicesState(controller, (s) => s.notice)
  const canPair = controller.canPair()

  // The card's last-seen readout re-derives against a ticking clock so "12s ago"
  // stays honest without each heartbeat carrying a formatted string. Skipped under
  // test, where the clock is pinned — the CD-407 guard, same reason.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [])

  // Drive the mock stream while the pane is open (only when we own the fallback; a
  // shell-injected source runs its own stream). Skipped under test — tests emit by hand.
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    if (provided) return
    return fallback.start()
  }, [provided, fallback])

  const [confirming, setConfirming] = useState<DeviceRecord | null>(null)

  const onConfirmRevoke = useCallback(() => {
    const device = confirming
    setConfirming(null)
    if (device) void controller.revoke(device.id)
  }, [controller, confirming])

  return (
    <section className="dv-pane" data-pane="devices" aria-label="Devices workspace">
      <header className="dv-header">
        <h2 className="dv-title">Devices</h2>
        <button
          type="button"
          className="dv-btn dv-btn-primary"
          data-testid="pair-new"
          disabled={!canPair}
          title={canPair ? undefined : PAIR_DISABLED_REASON}
          aria-describedby={canPair ? undefined : 'dv-pair-reason'}
          onClick={() => {
            /* enabled only once a pairing-capable source is bound (M5) */
          }}
        >
          Pair New Device
        </button>
      </header>

      {!canPair ? (
        <p id="dv-pair-reason" className="dv-pair-reason" data-testid="pair-reason">
          {PAIR_DISABLED_REASON}.
        </p>
      ) : null}

      {loading && devices.length === 0 ? (
        <p className="dv-empty" data-testid="devices-loading">
          Loading devices…
        </p>
      ) : devices.length === 0 ? (
        <p className="dv-empty" data-testid="devices-empty">
          No devices paired yet.
        </p>
      ) : (
        <ul className="dv-grid" data-testid="devices-grid" aria-label="Paired devices">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              revoking={revoking.includes(device.id)}
              now={now}
              onRevoke={setConfirming}
            />
          ))}
        </ul>
      )}

      {notice ? (
        <p className="dv-notice" data-kind={notice.kind} data-testid="devices-notice" role="status">
          {notice.text}
        </p>
      ) : null}

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)} label="Revoke device">
        <div className="dv-confirm" data-testid="revoke-dialog">
          <h3 className="dv-confirm-title">Revoke device?</h3>
          <p className="dv-confirm-body">
            {confirming
              ? `“${confirming.name}” will lose access and stop receiving layouts until it is paired again.`
              : ''}
          </p>
          <div className="dv-confirm-actions">
            <button type="button" className="dv-btn" data-testid="revoke-cancel" onClick={() => setConfirming(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="dv-btn dv-btn-danger"
              data-testid="revoke-confirm"
              onClick={onConfirmRevoke}
            >
              Revoke
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
