// Project summary (CD-405). Derives everything the browse table and the inspector
// show from a stored record — nothing here is hardcoded, and nothing is persisted:
// a project's counts are a projection of its document, so they can never drift from
// it. Documents that predate a field simply report zero.
import type { ProjectRecord } from '@/services/project'
import type { ProjectDocument } from '@/shared/project'

export type DeviceAssignment = NonNullable<ProjectDocument['devices']>[number]

export interface ProjectStats {
  pages: number
  widgets: number
  components: number
  styles: number
  assets: number
  /** Widgets carrying at least one property binding. */
  bound: number
}

export interface ProjectSummary {
  id: string
  name: string
  /** The workspace the project last authored in (meta.workspace). */
  workspace?: string
  createdAt?: string
  savedAt?: string
  stats: ProjectStats
  devices: DeviceAssignment[]
}

/** Summarize a listed record. Records with no storage key are skipped — the table
 *  keys, selects and mutates rows by id, so an unkeyed row has nothing to act on. */
export function summarize(record: ProjectRecord): ProjectSummary | null {
  if (!record.id) return null
  return {
    id: record.id,
    name: record.meta.name,
    workspace: record.meta.workspace,
    createdAt: record.meta.createdAt,
    savedAt: record.savedAt,
    stats: {
      pages: record.pages.length,
      widgets: record.pages.reduce((n, p) => n + p.widgets.length, 0),
      components: record.components?.length ?? 0,
      styles: Object.keys(record.styles ?? {}).length,
      assets: record.assets?.length ?? 0,
      bound: Object.keys(record.bindings ?? {}).length,
    },
    devices: record.devices ?? [],
  }
}

export function summarizeAll(records: ProjectRecord[]): ProjectSummary[] {
  return records.map(summarize).filter((s): s is ProjectSummary => s !== null)
}

/** Human date for a stored ISO timestamp; em-dash when the document never had one. */
export function formatStamp(iso: string | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
