// Project catalog port (CD-405). The Projects workspace browses and mutates stored
// projects through this narrow port — never through a repository import (the
// boundary matrix forbids workspaces→repositories). The composition root binds it
// to the gateway-backed ProjectsRepository, whose query/open/create/update/remove
// signatures satisfy this shape structurally, so the wiring is a plain pass:
//
//   const catalog: ProjectCatalog = new ProjectsRepository(gateway)
//
// Query params travel to the data layer verbatim — sorting and paging are the
// repository's job (mock or engine), never a client-side re-sort of a page slice.
import type { ProjectDocument } from '@/shared/project'

/**
 * A stored project: the document plus the key its collection lists it under.
 * The document schema itself has no `id` (a project is identified by its storage
 * key, not a field), so the id is optional here and read back off listed records.
 */
export type ProjectRecord = ProjectDocument & { id?: string }

export interface ProjectSort {
  field: string
  dir?: 'asc' | 'desc'
}

export interface ProjectQuery {
  filter?: Record<string, unknown>
  sort?: ProjectSort
  page?: number
  limit?: number
}

export interface ProjectPage {
  items: ProjectRecord[]
  page: number
  limit: number
  total?: number
}

export interface ProjectCatalog {
  query(params?: ProjectQuery): Promise<ProjectPage>
  open(id: string): Promise<ProjectRecord>
  create(body: unknown): Promise<ProjectRecord>
  update(id: string, body: unknown): Promise<ProjectRecord>
  remove(id: string): Promise<void>
}

/** The storage key of a listed record, or undefined for an unstored document. */
export function projectIdOf(record: ProjectRecord): string | undefined {
  return record.id
}
