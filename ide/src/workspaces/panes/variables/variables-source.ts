// The Variables data port (CD-401). The workspace may not import repositories
// (ide/README.md boundary matrix), so it reads through this narrow port and the
// app shell binds a VariablesRepository-backed adapter to it at assembly — the same
// move `variables-catalog.ts` (CD-324) documented for M4/M5.
//
// The query shape is deliberately RepositoryBase.QueryParams: {filter, sort, page,
// limit}. Search/scope/plugin/sort/paging are therefore *server* semantics that
// round-trip as repo params (CD-401 AC) — the table never filters what it was
// handed, it re-queries. The adapter is one object:
//
//   const source: VariablesSource = {
//     query: (q) => repo.query(q),                  // params pass straight through
//     write: (id, value) => repo.write(id, value),  // variables.write
//     reveal: (id) => repo.get(id).then((v) => v.value),
//     create: (draft) => repo.create(draft),        // ⚠ needs variables.create route
//     remove: (id) => repo.remove(id),              // ⚠ needs variables.delete route
//   }
import { createContext, useContext } from 'react'
import type { VariableRecord, VariableScope, VariableType } from './variables-model'

/** Sortable columns. Field names are the record's own keys — the repo sorts on them. */
export type VariableSortField = 'name' | 'id' | 'scope' | 'type' | 'value' | 'updatedAt'

export interface VariableSort {
  field: VariableSortField
  dir: 'asc' | 'desc'
}

/**
 * Filter params. `scope`/`plugin` are exact matches; `search` is a substring match
 * across name+id, which the mock honours server-side. NOTE: FixtureDB's filter is
 * exact-equality only today, so the repository adapter needs the `contains`
 * operator noted in the CD-401 report before `search` round-trips against it.
 */
export interface VariableFilter {
  scope?: VariableScope
  plugin?: string
  search?: string
}

export interface VariableQuery {
  filter?: VariableFilter
  sort?: VariableSort
  page?: number
  limit?: number
}

export interface VariablePage {
  items: VariableRecord[]
  page: number
  limit: number
  total: number
}

/** The fields a New Variable dialog collects (CD-402). */
export interface VariableDraft {
  id: string
  name: string
  scope: VariableScope
  type: VariableType
  value: unknown
  description?: string
  expr?: string
  options?: string[]
}

/** A place a variable is used — powers the inspector's "used by" list (CD-403). */
export interface VariableReference {
  /** Where clicking it navigates (a registered workspace id). */
  workspace: string
  /** Entity selected on arrival. */
  targetId: string
  /** Human label, e.g. "CPU Gauge". */
  label: string
  /** What kind of thing holds the reference. */
  kind: 'page' | 'component' | 'flow'
  /** The property/slot the variable feeds, e.g. "value". */
  via?: string
}

/** One past write — the inspector's history list (CD-403). */
export interface VariableHistoryEntry {
  ts: number
  value: unknown
  /** Who wrote it. */
  source: 'user' | 'flow' | 'engine' | 'plugin'
}

export interface VariablesSource {
  /** Server-side query: filter/sort/page/limit are honoured by the source. */
  query(q: VariableQuery): Promise<VariablePage>
  /** Write a value (variables.write). */
  write(id: string, value: unknown): Promise<VariableRecord>
  /** Create a variable. */
  create(draft: VariableDraft): Promise<VariableRecord>
  /** Delete a variable. */
  remove(id: string): Promise<void>
  /**
   * Fetch a masked secret's real value (variables.get). Secrets are masked in
   * `query` payloads, so this is the ONLY way a secret value reaches the client —
   * which is what keeps it out of the DOM until reveal (CD-402 AC).
   */
  reveal(id: string): Promise<unknown>
  /** Subscribe to live value ticks (variables.subscribe). Optional. */
  subscribe?(handler: (e: { id: string; value: unknown }) => void): () => void
  /**
   * Distinct owning-plugin ids — the plugin filter's options (a facet query, i.e.
   * `query({filter:{scope:'plugin'}})` reduced to distinct `plugin` values).
   * Optional: without it the pane disables the plugin filter with a stated reason.
   */
  plugins?(): Promise<string[]>
  /** Places each variable is used (CD-403). Optional — an empty list is honest. */
  references?(id: string): Promise<VariableReference[]>
  /** Recent writes (CD-403). Optional. */
  history?(id: string): Promise<VariableHistoryEntry[]>
  /**
   * Every derived variable (scope computed/expression) with its expression (CD-403).
   * The computed engine needs the whole derived set — not a paged slice — to build
   * the dependency graph and detect cycles. Kept off `query` so it never pollutes the
   * table's page bookkeeping. Optional: without it the workspace shows derived rows'
   * stored snapshot but does not live-evaluate.
   */
  derived?(): Promise<VariableRecord[]>
  /**
   * Current values for a set of paths (CD-403) — seeds the computed engine's
   * dependency values before the first tick. Optional; a missing dependency simply
   * evaluates as undefined (the sandbox's safe default).
   */
  values?(ids: string[]): Promise<Record<string, unknown>>
}

const SourceContext = createContext<VariablesSource | null>(null)
export const VariablesSourceProvider = SourceContext.Provider

/** The bound source, or null when the shell has not wired one yet. */
export function useVariablesSourceOptional(): VariablesSource | null {
  return useContext(SourceContext)
}
