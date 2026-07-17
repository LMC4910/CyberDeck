// Starter flows (CD-409) — what a first-run workspace seeds when the persistence
// seam reports an empty collection. Mirrors the mock gateway's `flows` seed
// (repositories/mock/seed.ts) so the M5 engine swap reads as continuous rather than
// as a different workspace. Ids are literal (never re-minted); the FlowModel's
// allocator reserves them on load.
import { UI_PARAM_KEY, type FlowDocument } from './flow-model'

export function starterFlows(): FlowDocument[] {
  return [
    {
      id: 'flow_strt0001',
      label: 'Stream Start',
      version: 1,
      armed: true,
      trigger: { kind: 'event', config: { event: 'obs.streaming.started', [UI_PARAM_KEY]: { x: 0, y: 0 } } },
      nodes: [
        { id: 'n_scene01', kind: 'integration.obs', params: { [UI_PARAM_KEY]: { x: 0, y: 140 } } },
        { id: 'n_alert01', kind: 'action.notify', params: { [UI_PARAM_KEY]: { x: 0, y: 280 } } },
      ],
      // The trigger fires the graph's ROOT nodes (nodes with no incoming edge) — it
      // is not itself an edge endpoint, matching core/flow's model.
      edges: [{ from: 'n_scene01', to: 'n_alert01', label: 'always' }],
    },
    {
      id: 'flow_lite0001',
      label: 'Toggle Lights',
      version: 1,
      armed: false,
      trigger: { kind: 'manual', config: { [UI_PARAM_KEY]: { x: 0, y: 0 } } },
      nodes: [
        {
          id: 'n_cmd0001',
          kind: 'action.command',
          params: { command: 'lights.toggle', [UI_PARAM_KEY]: { x: 0, y: 140 } },
        },
      ],
      edges: [],
    },
  ]
}
