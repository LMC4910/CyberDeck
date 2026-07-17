// Test harness for the Projects workspace (CD-405/406).
//
// FakeCatalog stands in for the ProjectsRepository the composition root binds. It
// RECORDS every query it is handed, so a test can assert that sorting and paging
// really travelled to the data layer, and it answers in an order of its own choosing
// so a test can prove the table renders the server's order rather than re-sorting it.
// The pane may not import repositories (boundary matrix), so the contract asserted
// here is the port's — the repository↔mock side is covered by the contract suite.
import type { ReactElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { UndoStack } from '@/platform/undo'
import { NotificationService, type Notification } from '@/services/notification'
import { MemoryStorageAdapter } from '@/services/persistence'
import {
  ProjectRecents,
  ProjectService,
  type ProjectCatalog,
  type ProjectPage,
  type ProjectQuery,
  type ProjectRecord,
} from '@/services/project'
import type { ProjectOpenedEvent } from '@/shared/contract'
import { ProjectsEnvProvider, type ProjectsEnv } from './use-projects-env'

export interface FakeCatalogOptions {
  /** Seed records, keyed by their id. */
  seed?: ProjectRecord[]
  /** Force an error out of query() (the table's error path). */
  failQuery?: string
}

export class FakeCatalog implements ProjectCatalog {
  readonly docs = new Map<string, ProjectRecord>()
  /** Every query() call, in order — the sort/page assertions read this. */
  readonly queries: ProjectQuery[] = []
  failQuery?: string

  constructor(options: FakeCatalogOptions = {}) {
    for (const d of options.seed ?? []) this.docs.set(d.id!, d)
    this.failQuery = options.failQuery
  }

  async query(params: ProjectQuery = {}): Promise<ProjectPage> {
    this.queries.push(params)
    if (this.failQuery) throw new Error(this.failQuery)
    // Answers in insertion order regardless of `sort` — standing in for a server
    // whose ordering the client must not second-guess.
    const all = [...this.docs.values()]
    const page = params.page ?? 1
    const limit = params.limit ?? 50
    const start = (page - 1) * limit
    return { items: all.slice(start, start + limit), page, limit, total: all.length }
  }

  async open(id: string): Promise<ProjectRecord> {
    const doc = this.docs.get(id)
    if (!doc) throw new Error(`project ${id} not found`)
    return structuredClone(doc)
  }

  async create(body: unknown): Promise<ProjectRecord> {
    const record = body as ProjectRecord
    const id = record.id ?? `proj_${this.docs.size.toString().padStart(6, '0')}`
    const stored = { ...structuredClone(record), id }
    this.docs.set(id, stored)
    return stored
  }

  async update(id: string, body: unknown): Promise<ProjectRecord> {
    const stored = { ...structuredClone(body as ProjectRecord), id }
    this.docs.set(id, stored)
    return stored
  }

  async remove(id: string): Promise<void> {
    if (!this.docs.delete(id)) throw new Error(`project ${id} not found`)
  }
}

/** A minimal, valid stored project. */
export function projectDoc(id: string, name: string, extra: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    format: 'cyberdeck.project',
    version: 1,
    id,
    meta: { name, workspace: 'deck-designer' },
    pages: [{ id: `page_${id.slice(-6)}`, name: 'Main Deck', canvas: { w: 800, h: 600 }, widgets: [] }],
    ...extra,
  }
}

export interface HarnessOptions extends FakeCatalogOptions {
  catalog?: FakeCatalog
}

export interface Harness {
  env: ProjectsEnv
  catalog: FakeCatalog
  project: ProjectService
  recents: ProjectRecents
  notifications: Notification[]
  opened: ProjectOpenedEvent[]
  navigated: string[]
  undo: UndoStack
}

/**
 * Build the environment the pane is assembled with. Autosave is wired straight back
 * into the catalog — the write-through the composition root performs at the engine
 * swap — so a create → author → reopen round-trip is a real one here.
 */
export function harness(options: HarnessOptions = {}): Harness {
  const catalog = options.catalog ?? new FakeCatalog(options)
  const notifications: Notification[] = []
  const opened: ProjectOpenedEvent[] = []
  const navigated: string[] = []
  const undo = new UndoStack()
  const recents = new ProjectRecents({ storage: new MemoryStorageAdapter() })
  const project = new ProjectService({
    persistence: { save: async (doc) => void (await catalog.update((doc as ProjectRecord).id!, doc)) },
    catalog,
    recents,
    onOpened: (e) => opened.push(e),
    debounceMs: 0,
  })
  const env: ProjectsEnv = {
    catalog,
    project,
    recents,
    notifications: new NotificationService({
      onNotify: (n) => notifications.push(n),
      rateLimit: { max: 100, windowMs: 1000 },
    }),
    undo,
    navigate: (id) => navigated.push(id),
  }
  return { env, catalog, project, recents, notifications, opened, navigated, undo }
}

export function renderWithEnv(ui: ReactElement, env: ProjectsEnv): RenderResult {
  return render(<ProjectsEnvProvider value={env}>{ui}</ProjectsEnvProvider>)
}
