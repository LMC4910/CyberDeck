// Projects workspace environment (CD-405). Everything the pane needs from outside
// its own folder, injected as one context value by the composition root:
//
//   • catalog       — stored-project access (bound to ProjectsRepository at assembly)
//   • project       — ProjectService: the open model + the open/create flow
//   • recents       — persisted MRU behind the dashboard's Recents card
//   • notifications — undo toasts for destructive row actions
//   • undo          — the platform undo stack the toast's Undo action drives
//   • navigate      — workspace routing (bound to WorkspaceService.setActive)
//
// One context, not six: the pane is assembled in exactly one place, and a single
// provider keeps that wiring honest and greppable. The pane reads it through
// useProjectsEnvOptional() so an unwired shell renders an honest empty state
// instead of throwing on the first-boot landing surface.
import { createContext, useContext } from 'react'
import type { ProjectCatalog, ProjectRecents, ProjectService } from '@/services/project'
import type { NotificationService } from '@/services/notification'
import type { UndoStack } from '@/platform/undo'

/** Where an opened project lands (the canonical authoring workspace). */
export const DESIGN_WORKSPACE = 'deck-designer'

export interface ProjectsEnv {
  catalog: ProjectCatalog
  project: ProjectService
  recents: ProjectRecents
  notifications: NotificationService
  undo: UndoStack
  /** Route to a workspace by id. */
  navigate: (workspaceId: string) => void
}

const EnvContext = createContext<ProjectsEnv | null>(null)
export const ProjectsEnvProvider = EnvContext.Provider

export function useProjectsEnvOptional(): ProjectsEnv | null {
  return useContext(EnvContext)
}

export function useProjectsEnv(): ProjectsEnv {
  const env = useContext(EnvContext)
  if (!env) throw new Error('useProjectsEnv must be used within a ProjectsEnvProvider')
  return env
}
