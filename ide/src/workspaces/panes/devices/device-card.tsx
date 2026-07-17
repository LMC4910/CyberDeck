// Device card (CD-415). One paired device: name, class, resolution, live status,
// heartbeat freshness and latency, plus the revoke control. Presentational — it
// takes a record and callbacks; the controller owns the data and the stream.
import type { DeviceRecord, DeviceStatus } from './devices-source'

/** Human labels for the four presence states (DeviceHeartbeatEvent.state). */
const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  paired: 'Paired',
  revoked: 'Revoked',
}

/** A short human-readable device-class name, falling back to the raw id. */
const CLASS_LABEL: Record<string, string> = {
  ipad: 'iPad',
  pixel: 'Pixel Tablet',
  'deck-mini': 'Deck Mini',
}

export function classLabel(deviceClass: string): string {
  return CLASS_LABEL[deviceClass] ?? deviceClass
}

/** Relative heartbeat freshness — deterministic under an injected clock. */
export function formatLastSeen(ts: number | undefined, now: number): string {
  if (ts === undefined) return 'never'
  const deltaMs = Math.max(0, now - ts)
  if (deltaMs < 2_000) return 'just now'
  const secs = Math.round(deltaMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export interface DeviceCardProps {
  device: DeviceRecord
  /** True while a revoke round-trip is in flight for this device. */
  revoking: boolean
  /** Clock for the last-seen readout (injectable for deterministic tests). */
  now: number
  onRevoke: (device: DeviceRecord) => void
}

export function DeviceCard({ device, revoking, now, onRevoke }: DeviceCardProps) {
  const { id, name, deviceClass, resolution, status, lastHeartbeatTs, latencyMs } = device
  const isRevoked = status === 'revoked'
  const cardLabel = `${name} — ${classLabel(deviceClass)}, ${STATUS_LABEL[status]}`

  return (
    <li className="dv-card" data-testid="device-card" data-device={id} data-status={status} aria-label={cardLabel}>
      <div className="dv-card-head">
        <div className="dv-card-title">
          <span className="dv-name">{name}</span>
          <span className="dv-class" data-testid="device-class">
            {classLabel(deviceClass)}
          </span>
        </div>
        <span className="dv-status" data-testid="device-status" data-status={status}>
          <span className="dv-dot" aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
      </div>

      <dl className="dv-meta">
        <div className="dv-meta-row">
          <dt>Resolution</dt>
          <dd data-testid="device-resolution">
            {resolution.width} × {resolution.height}
          </dd>
        </div>
        <div className="dv-meta-row">
          <dt>Heartbeat</dt>
          <dd data-testid="device-heartbeat">{formatLastSeen(lastHeartbeatTs, now)}</dd>
        </div>
        <div className="dv-meta-row">
          <dt>Latency</dt>
          <dd data-testid="device-latency">{latencyMs === undefined ? '—' : `${latencyMs} ms`}</dd>
        </div>
      </dl>

      <div className="dv-card-actions">
        <button
          type="button"
          className="dv-btn dv-btn-danger"
          data-testid="device-revoke"
          disabled={isRevoked || revoking}
          title={isRevoked ? 'This device is already revoked' : undefined}
          aria-label={`Revoke ${name}`}
          onClick={() => onRevoke(device)}
        >
          {revoking ? 'Revoking…' : 'Revoke'}
        </button>
      </div>
    </li>
  )
}
