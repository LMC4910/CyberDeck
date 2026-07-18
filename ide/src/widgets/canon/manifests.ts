// Canon widget manifests (CD-423). The M3 canon set expressed as platform manifests
// (CD-110) — the same widgets the Insert catalog (CD-315) offered, now discovered and
// loaded through the widget platform (CD-419/420) rather than hardcoded. Registering
// these (register.ts) surfaces them in every catalog surface via CD-421, and each maps
// 1:1 to a lazily-imported module (resolver.ts), so no widget is statically imported.
import type { WidgetManifest } from '@/services/widgets'

/** Build a canon manifest with the shared metadata shape. */
function canon(id: string, label: string, icon: string, category: string): WidgetManifest {
  return { id, version: '1.0.0', metadata: { label, icon, category } } as WidgetManifest
}

/** The 11 canon widgets (M3): ids match the CD-315 catalog types so the same authoring
 *  journey (insert/bind/state/undo) works on platform-loaded widgets. */
export const CANON_MANIFESTS: readonly WidgetManifest[] = [
  canon('gauge.circular', 'Circular Gauge', '◔', 'Data'),
  canon('stat.readout', 'Stat Readout', '№', 'Data'),
  canon('chart.line', 'Line Chart', '📈', 'Data'),
  canon('button.action', 'Action Button', '⬢', 'Controls'),
  canon('toggle.switch', 'Toggle', '◑', 'Controls'),
  canon('slider.range', 'Slider', '▭', 'Controls'),
  canon('input.field', 'Input Field', '⌨', 'Controls'),
  canon('text.label', 'Text', 'T', 'Text'),
  canon('image.static', 'Image', '🖼', 'Media'),
  canon('media.video', 'Media', '▶', 'Media'),
  canon('container.stack', 'Container', '▤', 'Layout'),
]

/** Canon widget ids, for the zero-static-import gate + resolver coverage checks. */
export const CANON_IDS: readonly string[] = CANON_MANIFESTS.map((m) => m.id)
