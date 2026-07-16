// Variables catalog (CD-324) — the searchable variable list the binding popover
// shows, with live-ish values. This mock stands in for the VariablesRepository
// (CD-124); CD-326 wires the live tick stream to bound widgets. M4/M5 swap this for
// the gateway-backed repository without changing the popover.
export interface VariableEntry {
  path: string
  label: string
  group: string
  value: number | string | boolean
}

export const VARIABLES_CATALOG: VariableEntry[] = [
  { path: 'system.cpu.percent', label: 'CPU %', group: 'System', value: 42 },
  { path: 'system.gpu.percent', label: 'GPU %', group: 'System', value: 63 },
  { path: 'system.ram.percent', label: 'RAM %', group: 'System', value: 71 },
  { path: 'system.net.down', label: 'Net ↓ (Mbps)', group: 'System', value: 128 },
  { path: 'fps.current', label: 'FPS', group: 'Game', value: 144 },
  { path: 'fps.max', label: 'FPS Max', group: 'Game', value: 240 },
  { path: 'audio.volume', label: 'Volume', group: 'Audio', value: 0.8 },
  { path: 'audio.muted', label: 'Muted', group: 'Audio', value: false },
  { path: 'media.title', label: 'Now Playing', group: 'Media', value: 'Untitled' },
]

export function searchVariables(query: string): VariableEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return VARIABLES_CATALOG
  return VARIABLES_CATALOG.filter((v) => v.path.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
}

export function variableValue(path: string): number | string | boolean | undefined {
  return VARIABLES_CATALOG.find((v) => v.path === path)?.value
}

/** A VarResolver over the catalog, for the expression editor's live preview (CD-325). */
export function catalogResolver(path: string): unknown {
  return variableValue(path)
}

export const KNOWN_VARIABLE_PATHS = VARIABLES_CATALOG.map((v) => v.path)
