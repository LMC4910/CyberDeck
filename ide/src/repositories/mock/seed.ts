// Mock seed data (CD-127). Design values (telemetry variables, a sample project +
// flows) plus the canon widget manifests, keyed by mock collection. Kept compact;
// the full schema fixtures back the contract suite (CD-135).
import type { Doc } from './fixture-db'

export type SeedMap = Record<string, Doc[]>

export function defaultSeed(): SeedMap {
  return {
    // design telemetry variables (DPVLAYOUTS stat sources)
    variables: [
      { id: 'sys.cpu.load', name: 'CPU Load', scope: 'telemetry', kind: 'scalar', value: 37 },
      { id: 'sys.gpu.temp', name: 'GPU Temp', scope: 'telemetry', kind: 'scalar', value: 64 },
      { id: 'sys.fps', name: 'FPS', scope: 'telemetry', kind: 'scalar', value: 144 },
      { id: 'net.ping', name: 'Ping', scope: 'telemetry', kind: 'scalar', value: 18 },
      { id: 'sys.ram', name: 'RAM', scope: 'telemetry', kind: 'scalar', value: 62 },
      { id: 'net.throughput', name: 'Net Throughput', scope: 'telemetry', kind: 'series', value: 0 },
    ],
    projects: [
      {
        id: 'proj_seed001',
        format: 'cyberdeck.project',
        version: 1,
        meta: { name: 'Battlestation', workspace: 'deck-designer' },
        pages: [{ id: 'page_home001', name: 'Main Deck', widgets: [] }],
      },
    ],
    flows: [
      {
        id: 'flow_strt0001',
        label: 'Stream Start',
        version: 1,
        armed: true,
        trigger: { kind: 'event', config: { event: 'obs.streaming.started' } },
        nodes: [],
        edges: [],
      },
    ],
    widgetManifests: [
      { id: 'gauge.circular', version: '1.2.0', metadata: { label: 'Circular Gauge' } },
      { id: 'button.action', version: '1.0.0', metadata: { label: 'Action Button' } },
      { id: 'media.nowplaying', version: '1.1.0', metadata: { label: 'Now Playing' } },
    ],
    assets: [{ id: 'ast_cam0001', kind: 'image', uri: 'asset://cam1.png' }],
    devices: [{ id: 'dev_ipad001', name: 'iPad', deviceClass: 'ipad', state: 'online' }],
    aiThreads: [],
  }
}
