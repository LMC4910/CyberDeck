// The Devices data port (CD-415). The workspace may not import repositories
// (ide/README.md boundary matrix), so it reads live device state through this
// narrow port and the app shell binds a DevicesRepository-backed adapter to it at
// assembly — the same M4/M5 swap the runtime feed (CD-407) and variables source
// (CD-401) set up. Until the shell wires one, the pane serves the in-memory mock
// (mock-devices-source.ts), so the workspace is honest and live on its own.
//
// The adapter the shell binds is one object over DevicesRepository:
//
//   const source: DevicesSource = {
//     list: () => repo.list().then(toDeviceRecords),   // devices.list
//     revoke: (id) => repo.revoke(id),                 // devices.revoke
//     onHeartbeat: (h) => repo.heartbeat(h),           // devices.heartbeat stream
//     // pair is intentionally absent until the engine's pairing handshake (M5).
//   }
import { createContext, useContext } from 'react'
import type { DeviceHeartbeatEvent } from '@/shared/contract'

/** Presence states, mirroring DeviceHeartbeatEvent.state (CD-114). */
export type DeviceStatus = DeviceHeartbeatEvent['state']

export interface DeviceResolution {
  width: number
  height: number
}

/** One row of the Devices workspace — the card's whole payload (CD-415). */
export interface DeviceRecord {
  id: string
  name: string
  /** Device family, e.g. 'ipad' | 'pixel' | 'deck-mini' (project-model deviceClass). */
  deviceClass: string
  resolution: DeviceResolution
  status: DeviceStatus
  /** unix ms of the most recent heartbeat frame, or undefined if never seen. */
  lastHeartbeatTs?: number
  /** Round-trip latency in ms from the most recent heartbeat. */
  latencyMs?: number
}

export interface DevicesSource {
  /** Current paired devices (devices.list). */
  list(): Promise<DeviceRecord[]>
  /** Revoke a device's pairing (devices.revoke). Round-trips: `list` reflects it after. */
  revoke(id: string): Promise<void>
  /** Subscribe to heartbeat frames (devices.heartbeat); returns an unsubscribe. */
  onHeartbeat(handler: (e: DeviceHeartbeatEvent) => void): () => void
  /**
   * Begin a pairing handshake. OPTIONAL and deliberately unimplemented on mocks:
   * the real flow (QR/code exchange, key provisioning) needs the engine, which
   * arrives at M5 (CD-417/418). Absent this, the pane disables "Pair New Device"
   * with a stated reason — the M2 honest-stub pattern, no dead control.
   */
  pair?(): Promise<void>
}

const SourceContext = createContext<DevicesSource | null>(null)
export const DevicesSourceProvider = SourceContext.Provider

/** The bound source, or null when the shell has not wired one yet. */
export function useDevicesSourceOptional(): DevicesSource | null {
  return useContext(SourceContext)
}
