// Starter document (CD-304). Seeds a new/empty workspace with something real to
// author until the Projects workspace can open a saved project. Valid against the
// cyberdeck.project schema and the ProjectModel invariants.
import type { ProjectDocument } from './types'

export function starterProject(): ProjectDocument {
  return {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: 'Starter Deck', workspace: 'deck-designer' },
    pages: [
      {
        id: 'page_start1',
        name: 'Main Deck',
        canvas: { w: 1180, h: 820 },
        widgets: [
          { id: 'w_cpu0001', type: 'gauge.circular', name: 'CPU', frame: { x: 48, y: 48, w: 240, h: 180 }, config: { max: 100 } },
          { id: 'w_fps0001', type: 'stat.readout', name: 'FPS', frame: { x: 320, y: 48, w: 200, h: 120 } },
          { id: 'w_btn0001', type: 'button.action', name: 'Mute', frame: { x: 48, y: 260, w: 160, h: 96 }, locked: true },
        ],
      },
    ],
  }
}
