// The design's CMDS() seed set (CD-121, Q1: adopt as-is). 24 commands across the
// General/Edit/Design/Project/View/Platform groups. Handlers delegate to an
// injected dispatcher (the real actions wire up as workspaces/services land);
// until then a command runs its dispatcher with its id. Non-global editing
// commands carry when-clauses so context gating is exercised from day one.
import type { CommandDescriptor } from './command-registry'

export type ActionDispatch = (id: string) => void

interface Seed {
  id: string
  category: string
  label: string
  icon: string
  keys: string[]
  when?: string
  undo?: boolean
}

const SEED: Seed[] = [
  { id: 'palette', category: 'General', label: 'Command Palette', icon: 'command', keys: ['⌘', 'K'] },
  { id: 'prefs', category: 'General', label: 'Preferences', icon: 'settings', keys: ['⌘', ','] },
  { id: 'undo', category: 'Edit', label: 'Undo', icon: 'undo-2', keys: ['⌘', 'Z'] },
  { id: 'redo', category: 'Edit', label: 'Redo', icon: 'redo-2', keys: ['⇧', '⌘', 'Z'] },
  { id: 'dup', category: 'Edit', label: 'Duplicate', icon: 'copy', keys: ['⌘', 'D'], when: 'selectionKind == widget', undo: true },
  { id: 'group', category: 'Edit', label: 'Group Selection', icon: 'group', keys: ['⌘', 'G'], when: 'selectionKind == widget', undo: true },
  { id: 'ungroup', category: 'Edit', label: 'Ungroup', icon: 'ungroup', keys: ['⇧', '⌘', 'G'], when: 'selectionKind == group', undo: true },
  { id: 'mkcomp', category: 'Edit', label: 'Create Component', icon: 'component', keys: ['⌥', '⌘', 'K'], when: 'selectionKind == widget', undo: true },
  { id: 'insert', category: 'Design', label: 'Insert Component', icon: 'plus-square', keys: ['I'], when: 'workspace == deck-designer', undo: true },
  { id: 'wizard', category: 'Project', label: 'Create Project', icon: 'plus', keys: ['⌘', 'N'] },
  { id: 'exportModel', category: 'Project', label: 'Export Project Model (JSON)', icon: 'file-json', keys: ['⇧', '⌘', 'E'] },
  { id: 'togL', category: 'View', label: 'Toggle Left Panel', icon: 'panel-left', keys: ['⌘', 'B'] },
  { id: 'togR', category: 'View', label: 'Toggle Right Panel', icon: 'panel-right', keys: ['⌘', 'J'] },
  { id: 'mirror', category: 'View', label: 'Toggle Live Mirror', icon: 'tablet', keys: ['⇧', '⌘', 'M'] },
  { id: 'minimap', category: 'View', label: 'Toggle Minimap', icon: 'map', keys: ['⇧', '⌘', 'L'] },
  { id: 'timeline', category: 'View', label: 'Version Timeline', icon: 'history', keys: ['⇧', '⌘', 'H'] },
  { id: 'drawer', category: 'View', label: 'Notifications', icon: 'bell', keys: ['⇧', '⌘', 'N'] },
  { id: 'themes', category: 'View', label: 'Switch Theme', icon: 'palette', keys: ['⇧', '⌘', 'T'] },
  { id: 'layout', category: 'View', label: 'Layout Presets', icon: 'layout-template', keys: ['⌥', '⌘', 'P'] },
  { id: 'integ', category: 'View', label: 'Integration Center', icon: 'plug', keys: ['⇧', '⌘', 'I'] },
  { id: 'devprev', category: 'View', label: 'Preview on Device (Player)', icon: 'monitor-smartphone', keys: ['⇧', '⌘', 'P'] },
  { id: 'archmode', category: 'Platform', label: 'Architecture Mode', icon: 'braces', keys: ['⌥', '⌘', 'A'] },
  { id: 'platform', category: 'Platform', label: 'Platform Inspector', icon: 'server-cog', keys: ['⇧', '⌘', 'D'] },
  { id: 'bootreplay', category: 'Platform', label: 'Replay Boot Sequence', icon: 'power', keys: [] },
]

/** Build the 24 seed command descriptors, delegating execution to `dispatch`. */
export function seedCommands(dispatch: ActionDispatch = () => {}): CommandDescriptor[] {
  return SEED.map((s) => ({
    id: s.id,
    category: s.category,
    label: s.label,
    icon: s.icon,
    keys: s.keys,
    when: s.when,
    undo: s.undo,
    telemetry: true,
    handler: () => dispatch(s.id),
  }))
}

/** The category groups the seed set covers, in design order. */
export const SEED_CATEGORIES = ['General', 'Edit', 'Design', 'Project', 'View', 'Platform'] as const
