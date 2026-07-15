// Settings search index (CD-210). Each searchable setting row declares its pane,
// label and keywords so the prefs search can match by label + keywords and jump to
// the owning pane. Fuzzy matching reuses the palette scorer.
import { fuzzyScore } from '@/shared/fuzzy'
import type { PreferencesTab } from './preferences-dialog'

export interface SettingEntry {
  id: string
  pane: PreferencesTab
  label: string
  keywords: string[]
}

export const SETTINGS_INDEX: SettingEntry[] = [
  { id: 'telemetry.enabled', pane: 'general', label: 'Send anonymous telemetry', keywords: ['privacy', 'tracking', 'analytics', 'crash'] },
  { id: 'density', pane: 'general', label: 'Density', keywords: ['spacing', 'compact', 'comfortable', 'spacious'] },
  { id: 'theme.id', pane: 'appearance', label: 'Theme', keywords: ['dark', 'light', 'color', 'appearance', 'colour'] },
  { id: 'keyboard', pane: 'keyboard', label: 'Keyboard shortcuts', keywords: ['keybinding', 'rebind', 'shortcut', 'hotkey'] },
]

/** Fuzzy-match settings by label + keywords; empty query returns nothing. */
export function searchSettings(query: string, index: SettingEntry[] = SETTINGS_INDEX): SettingEntry[] {
  if (query.trim() === '') return []
  return index
    .map((entry) => ({ entry, score: fuzzyScore(query, `${entry.label} ${entry.keywords.join(' ')}`) }))
    .filter((r): r is { entry: SettingEntry; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry)
}
