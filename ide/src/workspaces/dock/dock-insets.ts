// Dock inset computation (CD-215). Pinned docked tool windows inset the content
// area by their size on each side; unpinned/floating windows do not inset.
import type { ToolWindow } from '@/platform/dock'

export interface Insets {
  left: number
  right: number
  bottom: number
}

export function computeInsets(windows: ToolWindow[]): Insets {
  const insets: Insets = { left: 0, right: 0, bottom: 0 }
  for (const w of windows) {
    if (w.mode !== 'docked' || !w.pinned) continue
    insets[w.side] += w.size
  }
  return insets
}
