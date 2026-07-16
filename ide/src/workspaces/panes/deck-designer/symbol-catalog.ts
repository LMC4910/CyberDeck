// Symbol catalog (CD-322). A registry of reusable symbol assets grouped by type
// (icon / svg / lottie / animation), with favorites (persisted in localStorage) and
// live use-counts. Dropping a symbol adds a widget that references it by id; the
// use-count is the number of widgets referencing that symbol.
import type { ProjectModel, WidgetInstance } from '@/shared/project'
import type { SelectionEngine } from '@/stores'
import type { UndoStack } from '@/platform/undo'
import type { StorageAdapter } from '@/services/persistence'

export type SymbolGroup = 'icon' | 'svg' | 'lottie' | 'animation'

export interface SymbolAsset {
  id: string
  name: string
  group: SymbolGroup
  glyph: string
}

export const SYMBOL_CATALOG: SymbolAsset[] = [
  { id: 'sym_power0', name: 'Power', group: 'icon', glyph: '⏻' },
  { id: 'sym_play00', name: 'Play', group: 'icon', glyph: '▶' },
  { id: 'sym_pause0', name: 'Pause', group: 'icon', glyph: '⏸' },
  { id: 'sym_heart0', name: 'Heart', group: 'icon', glyph: '♥' },
  { id: 'sym_wave00', name: 'Waveform', group: 'svg', glyph: '〜' },
  { id: 'sym_grid00', name: 'Grid', group: 'svg', glyph: '▦' },
  { id: 'sym_spin00', name: 'Spinner', group: 'lottie', glyph: '◍' },
  { id: 'sym_pulse0', name: 'Pulse', group: 'lottie', glyph: '◉' },
  { id: 'sym_confet', name: 'Confetti', group: 'animation', glyph: '✷' },
]

export const SYMBOL_GROUPS: SymbolGroup[] = ['icon', 'svg', 'lottie', 'animation']

const FAV_KEY = 'cdk-symbol-favorites'

// Persistence goes through the injected StorageAdapter (the sanctioned path — no
// direct localStorage access, per the CD-117 architecture guard).
export function loadFavorites(storage: StorageAdapter): Set<string> {
  try {
    const raw = storage.get(FAV_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}
export function saveFavorites(storage: StorageAdapter, favs: Set<string>): void {
  storage.set(FAV_KEY, JSON.stringify([...favs]))
}

/** Number of widgets referencing `symbolId` (live use-count). */
export function symbolUseCount(model: ProjectModel, symbolId: string): number {
  let n = 0
  for (const p of model.pages()) {
    for (const w of p.widgets) if ((w.config as { symbol?: string } | undefined)?.symbol === symbolId) n++
  }
  return n
}

export interface SymbolCtx {
  model: ProjectModel
  undo: UndoStack
  engine: SelectionEngine
  pageId: string
}

/** Drop a symbol as a new widget centered on `center` (undoable). Returns the id. */
export function insertSymbol(ctx: SymbolCtx, symbol: SymbolAsset, center: { x: number; y: number }): string {
  const { model, undo, engine, pageId } = ctx
  const size = 48
  const node: WidgetInstance = {
    id: model.newId('widget'),
    type: `symbol.${symbol.group}`,
    name: symbol.name,
    frame: { x: Math.round(center.x - size / 2), y: Math.round(center.y - size / 2), w: size, h: size },
    config: { symbol: symbol.id, glyph: symbol.glyph },
  }
  undo.execUndoable(`Insert ${symbol.name}`, () => model.addWidget(pageId, node))
  engine.selectOnly(node.id)
  return node.id
}
