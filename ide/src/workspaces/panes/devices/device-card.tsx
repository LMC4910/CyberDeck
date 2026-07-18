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
  /** Assignable pages (CD-418): choose which layout this device renders. */
  pages?: readonly { id: string; label: string }[]
  onAssign?: (pageId: string) => void
  /** Open the player preview for this device (its assigned layout). */
  onPreview?: () => void
}

export function DeviceCard({ device, revoking, now, onRevoke, pages, onAssign, onPreview }: DeviceCardProps) {
  const { id, name, deviceClass, resolution, status, lastHeartbeatTs, latencyMs, assignedPageId } = device
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

      {pages && pages.length > 0 ? (
        <label className="dv-assign" data-testid="device-assign">
          <span className="dv-assign-label">Layout</span>
          <select
            value={assignedPageId ?? ''}
            aria-label={`Assign layout to ${name}`}
            onChange={(e) => {
              if (e.target.value) onAssign?.(e.target.value)
            }}
          >
            <option value="">Unassigned</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="dv-card-actions">
        {onPreview ? (
          <button
            type="button"
            className="dv-btn"
            data-testid="device-preview"
            disabled={isRevoked}
            aria-label={`Preview ${name}`}
            onClick={onPreview}
          >
            Preview
          </button>
        ) : null}
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
