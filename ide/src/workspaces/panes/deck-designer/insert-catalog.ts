// Insert catalog (CD-315) — the mock WidgetManifestRepo the Insert panel reads. Each
// entry mirrors the shape the real widget manifests (CD-110) expose: id/type, label,
// category, icon, default frame size, and default config. M4 (CD-4xx) swaps this for
// the gateway-backed WidgetManifestsRepository; the Insert UI is unchanged.
import type { ProjectModel, WidgetInstance } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'

export interface InsertManifest {
  type: string
  label: string
  category: string
  icon: string
  defaultSize: { w: number; h: number }
  defaults?: Record<string, unknown>
}

export const INSERT_CATALOG: InsertManifest[] = [
  { type: 'gauge.circular', label: 'Circular Gauge', category: 'Data', icon: '◔', defaultSize: { w: 200, h: 160 }, defaults: { min: 0, max: 100 } },
  { type: 'stat.readout', label: 'Stat Readout', category: 'Data', icon: '№', defaultSize: { w: 180, h: 110 }, defaults: { precision: 0 } },
  { type: 'chart.line', label: 'Line Chart', category: 'Data', icon: '📈', defaultSize: { w: 320, h: 200 }, defaults: { chartType: 'line', maxPoints: 60 } },
  { type: 'button.action', label: 'Action Button', category: 'Controls', icon: '⬢', defaultSize: { w: 160, h: 96 }, defaults: { label: 'Button', style: 'solid' } },
  { type: 'input.field', label: 'Input Field', category: 'Controls', icon: '⌨', defaultSize: { w: 220, h: 64 }, defaults: { inputKind: 'text' } },
  { type: 'text.label', label: 'Text', category: 'Text', icon: 'T', defaultSize: { w: 200, h: 48 }, defaults: { text: 'Text', size: 14 } },
  { type: 'image.static', label: 'Image', category: 'Media', icon: '🖼', defaultSize: { w: 240, h: 160 }, defaults: { fit: 'cover' } },
  { type: 'media.video', label: 'Media', category: 'Media', icon: '▶', defaultSize: { w: 320, h: 180 }, defaults: { muted: true } },
]

/** MIME-ish key the Insert tiles put on the drag payload. */
export const INSERT_DND_TYPE = 'application/x-cyberdeck-widget'

/** Build a fully-configured widget node from a manifest at a top-left world position. */
export function makeInsertNode(model: ProjectModel, manifest: InsertManifest, topLeft: { x: number; y: number }): WidgetInstance {
  return {
    id: model.newId('widget'),
    type: manifest.type,
    name: manifest.label,
    frame: { x: Math.round(topLeft.x), y: Math.round(topLeft.y), w: manifest.defaultSize.w, h: manifest.defaultSize.h },
    ...(manifest.defaults && Object.keys(manifest.defaults).length ? { config: { ...manifest.defaults } } : {}),
  }
}

/** Insert a manifest, centered on `center` (world), as one undoable step; selects it. */
export function insertManifest(
  ctx: { model: ProjectModel; undo: UndoStack; engine: SelectionEngine; pageId: string },
  manifest: InsertManifest,
  center: { x: number; y: number },
): string {
  const { model, undo, engine, pageId } = ctx
  const node = makeInsertNode(model, manifest, {
    x: center.x - manifest.defaultSize.w / 2,
    y: center.y - manifest.defaultSize.h / 2,
  })
  undo.execUndoable(`Insert ${manifest.label}`, () => model.addWidget(pageId, node))
  engine.selectOnly(node.id)
  return node.id
}
