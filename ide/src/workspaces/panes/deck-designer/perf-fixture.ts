// Canvas perf fixture (CD-309). A deterministic board of N widgets laid out in a
// grid, used by the perf harness to probe pan/zoom/drag frame rate at scale. Loaded
// via the `?perf=<n>` boot hook (dynamically imported, so it never ships in the main
// bundle). Valid against the cyberdeck.project schema + ProjectModel invariants.
import type { ProjectDocument, WidgetInstance } from '@/shared/project'

const TYPES = ['gauge.circular', 'stat.readout', 'button.action', 'text.label', 'chart.line']

export function generatePerfProject(count = 200): ProjectDocument {
  const cols = Math.ceil(Math.sqrt(count))
  const cell = 140
  const gap = 20
  const widgets: WidgetInstance[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    widgets.push({
      id: `w_p${i.toString().padStart(6, '0')}`,
      type: TYPES[i % TYPES.length]!,
      name: `W${i}`,
      frame: {
        x: 40 + col * (cell + gap),
        y: 40 + row * (cell + gap),
        w: cell,
        h: cell - 40,
      },
      config: { max: 100 },
    })
  }
  const rows = Math.ceil(count / cols)
  return {
    format: 'cyberdeck.project',
    version: 1,
    meta: { name: `Perf ${count}`, workspace: 'deck-designer' },
    pages: [
      {
        id: 'page_perf01',
        name: 'Perf Board',
        canvas: { w: 40 + cols * (cell + gap) + 40, h: 40 + rows * (cell + gap) + 40 },
        widgets,
      },
    ],
  }
}
