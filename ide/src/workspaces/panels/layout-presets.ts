// Layout presets (CD-217). A preset is config {lpw, rpw, hideL, hideR} applied to
// a workspace's panel state. Built-ins per the design; user presets persist. A
// manual panel change that matches no preset shows as "Custom".
import type { Store } from '@/stores'
import {
  panelFor,
  setPanelWidth,
  setPanelVisible,
  clampWidth,
  type PanelsState,
} from './panels-model'

export interface LayoutPreset {
  name: string
  lpw: number // left panel width
  rpw: number // right panel width
  hideL: boolean
  hideR: boolean
}

export const CUSTOM = 'Custom'

export const BUILTIN_PRESETS: LayoutPreset[] = [
  { name: 'Balanced', lpw: 260, rpw: 260, hideL: false, hideR: false },
  { name: 'Focus', lpw: 260, rpw: 260, hideL: true, hideR: true },
  { name: 'Explorer', lpw: 320, rpw: 260, hideL: false, hideR: true },
  { name: 'Inspector', lpw: 260, rpw: 320, hideL: true, hideR: false },
  { name: 'Docked Tools', lpw: 240, rpw: 300, hideL: false, hideR: false },
]

/** Apply a preset to a workspace's panels (widths clamped, visibility set). */
export function applyPreset(store: Store<PanelsState>, workspaceId: string, preset: LayoutPreset): void {
  setPanelWidth(store, workspaceId, 'left', preset.lpw)
  setPanelWidth(store, workspaceId, 'right', preset.rpw)
  setPanelVisible(store, workspaceId, 'left', !preset.hideL)
  setPanelVisible(store, workspaceId, 'right', !preset.hideR)
}

/** The preset a workspace's current panel state matches, or CUSTOM. */
export function currentPresetName(
  state: PanelsState,
  workspaceId: string,
  presets: LayoutPreset[] = BUILTIN_PRESETS,
): string {
  const p = panelFor(state, workspaceId)
  const match = presets.find(
    (preset) =>
      preset.lpw === p.leftWidth &&
      preset.rpw === p.rightWidth &&
      preset.hideL === !p.leftVisible &&
      preset.hideR === !p.rightVisible,
  )
  return match?.name ?? CUSTOM
}

/** Capture a workspace's current panel state as a named user preset. */
export function capturePreset(state: PanelsState, workspaceId: string, name: string): LayoutPreset {
  const p = panelFor(state, workspaceId)
  return {
    name,
    lpw: clampWidth(p.leftWidth),
    rpw: clampWidth(p.rightWidth),
    hideL: !p.leftVisible,
    hideR: !p.rightVisible,
  }
}
