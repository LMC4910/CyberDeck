// Devices workspace controller (CD-415). Owns the pane's roster on the `stores`
// primitive (not React state — the blueprint's "no React state for cross-component
// domain data"), and is the only thing that talks to the port. It is a pane-local
// controller store (like VariablesController's), NOT a 14th kernel store.
//
// Two live inputs land here: the initial `list()` and the heartbeat stream. A frame
// patches exactly the card it names (status/last-seen/latency), so a heartbeat
// repaints one card, not the grid. Revoke round-trips the source: on success it
// re-lists, so the roster reflects the mock's persisted truth (CD-415 AC).
import { createStore, type Store } from '@/stores'
import type { DeviceHeartbeatEvent } from '@/shared/contract'
import type { DeviceRecord, DevicesSource } from './devices-source'

export interface DevicesNotice {
  kind: 'error' | 'info'
  text: string
}

export interface DevicesState {
  devices: DeviceRecord[]
  /** True until the first list lands. */
  loading: boolean
  /** Ids with a revoke in flight — the card disables its own control meanwhile. */
  revoking: string[]
  notice?: DevicesNotice
}

export function initialDevicesState(): DevicesState {
  return { devices: [], loading: true, revoking: [] }
}

export class DevicesController {
  readonly store: Store<DevicesState>
  private source: DevicesSource
  /** Bumped on every (re)bind so a stale list response is dropped. */
  private generation = 0
  private heartbeatUnsub?: () => void

  constructor(source: DevicesSource) {
    this.source = source
    this.store = createStore<DevicesState>(initialDevicesState(), {
      name: 'devicesPane',
      kind: 'temp',
    })
  }

  get state(): DevicesState {
    return this.store.getState()
  }

  /** (Re)load the roster from the source. */
  refresh(): void {
    const gen = ++this.generation
    this.store.setState((s) => ({ ...s, loading: true }))
    void this.source
      .list()
      .then((devices) => {
        if (gen !== this.generation) return // a newer load supersedes this response
        this.store.setState((s) => ({ ...s, devices, loading: false }))
      })
      .catch((error: unknown) => {
        if (gen !== this.generation) return
        this.store.setState((s) => ({
          ...s,
          loading: false,
          notice: { kind: 'error', text: `Could not load devices: ${messageOf(error)}` },
        }))
      })
  }

  /** Subscribe to the heartbeat stream; a frame patches the named card live. */
  subscribeHeartbeat(): void {
    this.heartbeatUnsub?.()
    this.heartbeatUnsub = this.source.onHeartbeat((e) => this.applyHeartbeat(e))
  }

  /** Fold one heartbeat frame into the matching card (CD-415 AC: live update). */
  applyHeartbeat(e: DeviceHeartbeatEvent): void {
    this.store.setState((s) => {
      let changed = false
      const devices = s.devices.map((d) => {
        if (d.id !== e.deviceId) return d
        changed = true
        return {
          ...d,
          status: e.state,
          lastHeartbeatTs: e.ts ?? d.lastHeartbeatTs,
          latencyMs: e.rttMs ?? d.latencyMs,
        }
      })
      return changed ? { ...s, devices } : s
    })
  }

  /**
   * Revoke a device, then re-list so the roster reflects the source's persisted
   * truth (CD-415 AC: round-trips the mock). A failure surfaces a notice and leaves
   * the card intact.
   */
  async revoke(id: string): Promise<boolean> {
    if (this.state.revoking.includes(id)) return false
    this.store.setState((s) => ({ ...s, revoking: [...s.revoking, id], notice: undefined }))
    try {
      await this.source.revoke(id)
      this.refresh()
      this.store.setState((s) => ({
        ...s,
        revoking: s.revoking.filter((x) => x !== id),
        notice: { kind: 'info', text: `Revoked ${id}` },
      }))
      return true
    } catch (error) {
      this.store.setState((s) => ({
        ...s,
        revoking: s.revoking.filter((x) => x !== id),
        notice: { kind: 'error', text: `Could not revoke ${id}: ${messageOf(error)}` },
      }))
      return false
    }
  }

  /** Whether the source can pair — false on mocks (needs the engine, M5). */
  canPair(): boolean {
    return typeof this.source.pair === 'function'
  }

  setNotice(notice: DevicesNotice | undefined): void {
    this.store.setState((s) => ({ ...s, notice }))
  }

  /** Swap the bound source (the shell wiring a repository adapter after boot). */
  bind(source: DevicesSource): void {
    if (source === this.source) return
    this.source = source
    this.refresh()
    this.subscribeHeartbeat()
  }

  /** Release the heartbeat subscription (pane unmount). */
  dispose(): void {
    this.heartbeatUnsub?.()
    this.heartbeatUnsub = undefined
  }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
