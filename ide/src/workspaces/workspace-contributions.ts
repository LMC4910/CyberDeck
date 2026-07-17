// The 7 workspace contributions (CD-203). Each declares a lazyPane loader that
// dynamic-imports its pane module → Vite code-splits each into its own chunk.
// Adding/removing a workspace is editing this list (config), not the shell.
//
// Two orderings live here and they are NOT the same thing:
//  - `order` drives the rail's display order (WorkspaceService.list() sorts by it);
//  - declaration order seeds the default active workspace (WorkspaceService.register
//    activates the first one registered), which is what an unrestored first boot
//    lands on. Projects is declared first so first boot opens the dashboard
//    (recents + templates); session restore (CD-212) overrides it on later boots.
import type { WorkspaceContribution } from '@/services/workspace'

export const WORKSPACE_CONTRIBUTIONS: WorkspaceContribution[] = [
  { id: 'projects', label: 'Projects', icon: 'folder-git-2', order: 5, lazyPane: () => import('./panes/projects-pane') },
  { id: 'deck-designer', label: 'Deck Designer', icon: 'layout-dashboard', order: 0, lazyPane: () => import('./panes/deck-designer-pane') },
  { id: 'flows', label: 'Flows', icon: 'workflow', order: 1, lazyPane: () => import('./panes/flows-pane') },
  { id: 'variables', label: 'Variables', icon: 'variable', order: 2, lazyPane: () => import('./panes/variables-pane') },
  { id: 'library', label: 'Library', icon: 'library', order: 3, lazyPane: () => import('./panes/library-pane') },
  { id: 'devices', label: 'Devices', icon: 'tablet-smartphone', order: 4, lazyPane: () => import('./panes/devices-pane') },
  { id: 'runtime', label: 'Runtime', icon: 'activity', order: 6, lazyPane: () => import('./panes/runtime-pane') },
]
