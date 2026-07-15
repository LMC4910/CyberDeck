// The 7 workspace contributions (CD-203). Each declares a lazyPane loader that
// dynamic-imports its pane module → Vite code-splits each into its own chunk.
// Adding/removing a workspace is editing this list (config), not the shell.
import type { WorkspaceContribution } from '@/services/workspace'

export const WORKSPACE_CONTRIBUTIONS: WorkspaceContribution[] = [
  { id: 'home', label: 'Home', icon: 'home', order: 0, lazyPane: () => import('./panes/home-pane') },
  { id: 'deck-designer', label: 'Deck Designer', icon: 'layout-dashboard', order: 1, lazyPane: () => import('./panes/deck-designer-pane') },
  { id: 'flows', label: 'Flows', icon: 'workflow', order: 2, lazyPane: () => import('./panes/flows-pane') },
  { id: 'variables', label: 'Variables', icon: 'variable', order: 3, lazyPane: () => import('./panes/variables-pane') },
  { id: 'library', label: 'Library', icon: 'library', order: 4, lazyPane: () => import('./panes/library-pane') },
  { id: 'devices', label: 'Devices', icon: 'tablet-smartphone', order: 5, lazyPane: () => import('./panes/devices-pane') },
  { id: 'projects', label: 'Projects', icon: 'folder-git-2', order: 6, lazyPane: () => import('./panes/projects-pane') },
]
