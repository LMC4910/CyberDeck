// Row actions (CD-405 menu / CD-406 open flow). Every destructive action is a real
// undo entry on the platform stack, not a bespoke "undo" bolt-on: the toast's Undo
// button and ⌘Z run the same inverse, and the action shows up in history like any
// other edit. The toast carries an `undo` action id, which the shell's Toaster
// already routes to UndoStack.undo() — no new wiring, no dead control.
import { useCallback } from 'react'
import type { UndoStack } from '@/platform/undo'
import type { NotificationService } from '@/services/notification'
import type { ProjectRecord } from '@/services/project'
import { DESIGN_WORKSPACE, useProjectsEnv, type ProjectsEnv } from './use-projects-env'
import { copyName, duplicateProject } from './templates'
import type { ProjectSummary } from './project-summary'
import type { ProjectTable } from './use-project-table'

/** The minimum a row needs to be acted on — a table row and a recent both qualify. */
export type ProjectRef = Pick<ProjectSummary, 'id' | 'name'>

export interface ProjectActions {
  /** Load the project and land in the Design workspace (CD-406). */
  open: (row: ProjectRef) => Promise<void>
  duplicate: (row: ProjectRef) => Promise<void>
  remove: (row: ProjectRef) => Promise<void>
}

export interface ProjectActionOptions {
  /** Called with the new row's id after a duplicate, so the table can select it. */
  onDuplicated?: (id: string) => void
  /** Called after a delete lands, so the table can drop its selection. */
  onDeleted?: (id: string) => void
}

export function useProjectActions(table: ProjectTable, options: ProjectActionOptions = {}): ProjectActions {
  const env = useProjectsEnv()
  const { onDuplicated, onDeleted } = options
  const { catalog, project, recents, notifications, undo, navigate } = env

  const fail = useCallback(
    (title: string, err: unknown) => {
      notifications.notify({
        level: 'error',
        source: 'Projects',
        title,
        body: err instanceof Error ? err.message : String(err),
      })
    },
    [notifications],
  )

  const open = useCallback(
    async (row: ProjectRef) => {
      try {
        // ProjectService flushes the outgoing project, loads the document, hydrates
        // the model, records the recent and announces ProjectOpened; routing to the
        // authoring workspace is ours (the service stays navigation-agnostic).
        await project.openById(row.id)
        navigate(DESIGN_WORKSPACE)
      } catch (err) {
        fail(`Could not open “${row.name}”`, err)
      }
    },
    [project, navigate, fail],
  )

  const duplicate = useCallback(
    async (row: ProjectRef) => {
      const record = table.records.find((r) => r.id === row.id)
      if (!record) return
      const copy = duplicateProject(record, copyName(row.name, table.rows.map((r) => r.name)))
      const id = copy.id!
      try {
        await undoableAsync(
          undo,
          'Duplicate project',
          () => catalog.create(copy).then(() => table.refresh()),
          () => catalog.remove(id).then(() => table.refresh()),
        )
        onDuplicated?.(id)
        toastUndo(notifications, `Duplicated as “${copy.meta.name}”`)
      } catch (err) {
        fail(`Could not duplicate “${row.name}”`, err)
      }
    },
    [table, catalog, undo, notifications, onDuplicated, fail],
  )

  const remove = useCallback(
    async (row: ProjectRef) => {
      const record = table.records.find((r) => r.id === row.id)
      if (!record) return
      try {
        await undoableAsync(
          undo,
          'Delete project',
          () => catalog.remove(row.id).then(() => table.refresh()),
          // Restore re-creates the document under its original key, so anything
          // referencing the project by id (recents, the open model) still resolves.
          () => catalog.create(record).then(() => table.refresh()),
        )
        recents.remove(row.id)
        onDeleted?.(row.id)
        toastUndo(notifications, `Deleted “${row.name}”`)
      } catch (err) {
        fail(`Could not delete “${row.name}”`, err)
      }
    },
    [table, catalog, undo, recents, notifications, onDeleted, fail],
  )

  return { open, duplicate, remove }
}

/** An undo toast: the action id the shell's Toaster maps to UndoStack.undo(). */
function toastUndo(notifications: NotificationService, title: string): void {
  notifications.notify({
    level: 'info',
    source: 'Projects',
    title,
    actions: [{ id: 'undo', label: 'Undo' }],
  })
}

/**
 * Register an async mutation as an undo entry and await its first application.
 * UndoStack's `apply` contract is synchronous (it returns the inverse), so the
 * promise is captured out of the closure: apply fires the request and hands back a
 * revert that fires the opposite one. Redo re-runs `apply` — hence both directions
 * are written as complete, repeatable requests rather than one-shot patches.
 */
async function undoableAsync(
  undo: UndoStack,
  label: string,
  apply: () => Promise<void>,
  revert: () => Promise<void>,
): Promise<void> {
  const applied: Promise<void>[] = []
  undo.execUndoable(label, () => {
    applied.push(apply())
    return () => void revert()
  })
  await applied[0]
}

/** Stores the wizard's freshly built project, opens it and lands in Design (CD-406). */
export async function createAndOpen(env: ProjectsEnv, record: ProjectRecord): Promise<void> {
  await env.project.createProject(record)
  env.navigate(DESIGN_WORKSPACE)
}
