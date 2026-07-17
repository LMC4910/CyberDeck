// Browse-table state (CD-405). Sorting and paging are REPOSITORY concerns: every
// sort click and page step re-queries the catalog with `{ sort, page, limit }` and
// renders whatever comes back, in the order it comes back. Nothing here re-sorts or
// re-slices a page client-side — a client sort would only order the rows the server
// already chose, which is a lie at any page size smaller than the collection.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectCatalog, ProjectRecord, ProjectSort } from '@/services/project'
import { summarizeAll, type ProjectSummary } from './project-summary'

export const PAGE_SIZE = 50

/**
 * Columns the data layer can order by. Deliberately only the fields the repository
 * query honors — the mock (and the engine route behind it) sort on top-level
 * document fields, so nested ones like `meta.name` are NOT offered rather than
 * offered and silently ignored. See the header note in projects-table.tsx.
 */
export type SortField = 'savedAt' | 'id'

export const DEFAULT_SORT: ProjectSort = { field: 'savedAt', dir: 'desc' }

export interface ProjectTable {
  records: ProjectRecord[]
  rows: ProjectSummary[]
  sort: ProjectSort
  page: number
  limit: number
  total: number
  totalPages: number
  loading: boolean
  error: string | null
  /** Sort by `field`; clicking the active field flips direction (and returns to page 1). */
  toggleSort: (field: SortField) => void
  setPage: (page: number) => void
  /** Re-run the current query (after a create/duplicate/delete). */
  refresh: () => void
}

export function useProjectTable(catalog: ProjectCatalog, limit = PAGE_SIZE): ProjectTable {
  const [sort, setSort] = useState<ProjectSort>(DEFAULT_SORT)
  const [page, setPageState] = useState(1)
  const [nonce, setNonce] = useState(0)
  const [records, setRecords] = useState<ProjectRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Guards against an out-of-order response overwriting a newer one.
  const seq = useRef(0)

  useEffect(() => {
    const ticket = ++seq.current
    let live = true
    setLoading(true)
    catalog
      .query({ sort, page, limit })
      .then((result) => {
        if (!live || ticket !== seq.current) return
        setRecords(result.items)
        setTotal(result.total ?? result.items.length)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!live || ticket !== seq.current) return
        setRecords([])
        setTotal(0)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (live && ticket === seq.current) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [catalog, sort, page, limit, nonce])

  const rows = useMemo(() => summarizeAll(records), [records])
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const toggleSort = useCallback((field: SortField) => {
    setSort((s) => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))
    setPageState(1)
  }, [])

  const setPage = useCallback(
    (next: number) => setPageState(Math.max(1, next)),
    [],
  )
  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  return {
    records, rows, sort, page, limit, total, totalPages, loading, error,
    toggleSort, setPage, refresh,
  }
}
