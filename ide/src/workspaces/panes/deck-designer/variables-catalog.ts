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

import type { VariableRuntime } from '@/stores'

/** Seed the runtime with the catalog's current values. */
export function seedRuntime(runtime: VariableRuntime): void {
  for (const v of VARIABLES_CATALOG) runtime.tick(v.path, v.value)
}

/**
 * A mock live stream (CD-326): jitters a few numeric variables each interval and
 * ticks them. Returns a cleanup. `schedule`/`cancel` are injectable for tests.
 */
export function startMockTicks(
  runtime: VariableRuntime,
  opts: { intervalMs?: number; schedule?: (fn: () => void, ms: number) => number; cancel?: (h: number) => void } = {},
): () => void {
  const schedule = opts.schedule ?? ((fn, ms) => setInterval(fn, ms) as unknown as number)
  const cancel = opts.cancel ?? ((h) => clearInterval(h))
  const live = ['system.cpu.percent', 'system.gpu.percent', 'fps.current']
  let seed = 1
  const h = schedule(() => {
    for (const path of live) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const base = VARIABLES_CATALOG.find((v) => v.path === path)?.value
      if (typeof base === 'number') runtime.tick(path, Math.round(base + ((seed % 20) - 10)))
    }
  }, opts.intervalMs ?? 1000)
  return () => cancel(h)
}
