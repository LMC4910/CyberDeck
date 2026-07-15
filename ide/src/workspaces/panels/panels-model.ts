// Resizable panels model (CD-213). Per-workspace left/right panel widths +
// visibility, clamped to [MIN, MAX]. State lives in a persisted store (Workspace
// store / cdk-layout) so widths restore per workspace across relaunch.
import type { Store } from '@/stores'

export const PANEL_MIN = 180
export const PANEL_MAX = 480
export const PANEL_DEFAULT = 260

export type PanelSide = 'left' | 'right'

export interface PanelState {
  leftWidth: number
  rightWidth: number
  leftVisible: boolean
  rightVisible: boolean
}

export interface PanelsState {
  panels: Record<string, PanelState>
}

export function clampWidth(w: number): number {
  return Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(w)))
}

const defaultPanel = (): PanelState => ({
  leftWidth: PANEL_DEFAULT,
  rightWidth: PANEL_DEFAULT,
  leftVisible: true,
  rightVisible: true,
})

/** Panel state for a workspace (defaults if unseen). */
export function panelFor(state: PanelsState, workspaceId: string): PanelState {
  return state.panels[workspaceId] ?? defaultPanel()
}

function update(
  store: Store<PanelsState>,
  workspaceId: string,
  patch: Partial<PanelState>,
): void {
  store.setState((s) => {
    const current = s.panels[workspaceId] ?? defaultPanel()
    return { panels: { ...s.panels, [workspaceId]: { ...current, ...patch } } }
  })
}

/** Set a side's width (clamped) for a workspace. */
export function setPanelWidth(
  store: Store<PanelsState>,
  workspaceId: string,
  side: PanelSide,
  width: number,
): void {
  update(store, workspaceId, side === 'left' ? { leftWidth: clampWidth(width) } : { rightWidth: clampWidth(width) })
}

/** Toggle a side's visibility for a workspace. */
export function togglePanel(store: Store<PanelsState>, workspaceId: string, side: PanelSide): void {
  const current = panelFor(store.getState(), workspaceId)
  update(store, workspaceId, side === 'left' ? { leftVisible: !current.leftVisible } : { rightVisible: !current.rightVisible })
}

export function setPanelVisible(
  store: Store<PanelsState>,
  workspaceId: string,
  side: PanelSide,
  visible: boolean,
): void {
  update(store, workspaceId, side === 'left' ? { leftVisible: visible } : { rightVisible: visible })
}
