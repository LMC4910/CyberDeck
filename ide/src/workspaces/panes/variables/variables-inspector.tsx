// Variables right inspector (CD-403). Details / History / Refs for the single
// selected variable. Three jobs the table cannot do inline:
//
//   • DETAILS — the full record, and for a derived (computed/expression) variable
//     its expression, its "depends on" list, and the LIVE evaluation result. A
//     cyclic or invalid expression shows its error message here (the "cycle rejected
//     with a message" AC, surfaced where the author is looking).
//   • HISTORY — recent writes (value + who wrote it), the audit the value cell omits.
//   • REFS — "used by": every page/component/flow that binds this variable. Clicking
//     one NAVIGATES to that workspace and SELECTS the target. The workspace boundary
//     forbids reaching another workspace's selection store, so the click goes through
//     the injected `navigate(ref)` env (variables-env.ts); an unwired shell disables
//     the targets with an honest reason rather than shipping dead controls.
import { useEffect, useState } from 'react'
import { Tabs, TabList, Tab, TabPanel } from '@/shared/a11y'
import {
  formatRaw,
  formatValue,
  isDerivedScope,
  scopeMeta,
  typeMeta,
  type VariableRecord,
} from './variables-model'
import type { VariablesController } from './variables-controller'
import type { ComputedResult } from './computed-engine'
import type { VariablesSource } from './variables-source'
import { useVariablesEnvOptional } from './variables-env'
import { useVariablesState, shallowArrayEqual } from './use-variables'

export interface VariablesInspectorProps {
  controller: VariablesController
  source: VariablesSource
}

/** The single selected variable, or undefined when 0 or many are selected. */
function soleSelection(ids: readonly string[]): string | undefined {
  return ids.length === 1 ? ids[0] : undefined
}

export function VariablesInspector({ controller, source }: VariablesInspectorProps) {
  const selectedIds = useVariablesState(controller, (s) => s.selectedIds, shallowArrayEqual)
  const id = soleSelection(selectedIds)
  if (!id) return null
  // Keyed remount per selection: tab state + async fetches reset for the new target.
  return <InspectorBody key={id} controller={controller} source={source} id={id} />
}

type TabId = 'details' | 'history' | 'refs'

function InspectorBody({
  controller,
  source,
  id,
}: VariablesInspectorProps & { id: string }) {
  const row = controller.rowById(id)
  const [tab, setTab] = useState<TabId>('details')

  return (
    <aside className="vars-inspector" data-testid="vars-inspector" aria-label={`Inspector: ${row?.name ?? id}`}>
      <div className="vars-inspector-title">{row?.name ?? id}</div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} label="Variable inspector">
        <TabList label="Inspector sections">
          <Tab value="details">Details</Tab>
          <Tab value="history">History</Tab>
          <Tab value="refs">Refs</Tab>
        </TabList>
        <TabPanel value="details">
          {row ? <DetailsPanel controller={controller} row={row} /> : <p className="vars-empty">Row not loaded.</p>}
        </TabPanel>
        <TabPanel value="history">
          <HistoryPanel source={source} id={id} />
        </TabPanel>
        <TabPanel value="refs">
          <RefsPanel source={source} id={id} />
        </TabPanel>
      </Tabs>
    </aside>
  )
}

function DetailsPanel({ controller, row }: { controller: VariablesController; row: VariableRecord }) {
  const derived = isDerivedScope(row.scope)
  const computed = useVariablesState(controller, (s) => s.computed[row.id])
  return (
    <dl className="vars-details" data-testid="inspector-details">
      <Field label="Path" value={<code>{row.id}</code>} />
      <Field label="Scope" value={scopeMeta(row.scope)?.label ?? row.scope} />
      <Field label="Type" value={typeMeta(row.type)?.label ?? row.type} />
      <Field label="Value" value={<ValueReadout row={row} computed={computed} derived={derived} />} />
      {derived ? <DerivedDetails controller={controller} row={row} computed={computed} /> : null}
      {row.description ? <Field label="Description" value={row.description} /> : null}
      {row.updatedAt ? <Field label="Updated" value={absolute(row.updatedAt)} /> : null}
    </dl>
  )
}

/** The value the inspector shows: derived vars read the live engine result. */
function ValueReadout({
  row,
  computed,
  derived,
}: {
  row: VariableRecord
  computed: ComputedResult | undefined
  derived: boolean
}) {
  if (!derived) return <span>{formatValue(row)}</span>
  if (!computed) return <span className="vars-muted">evaluating…</span>
  if (!computed.ok) return <span className="vars-warning">unavailable</span>
  return <span>{formatRaw(computed.value, row.type)}</span>
}

function DerivedDetails({
  controller,
  row,
  computed,
}: {
  controller: VariablesController
  row: VariableRecord
  computed: ComputedResult | undefined
}) {
  const deps = controller.dependenciesOf(row.id)
  return (
    <>
      <Field label="Expression" value={<code className="vars-expr">{row.expr ?? '—'}</code>} />
      <Field
        label="Depends on"
        value={
          deps.length ? (
            <ul className="vars-dep-list">
              {deps.map((d) => (
                <li key={d}>
                  <code>{d}</code>
                </li>
              ))}
            </ul>
          ) : (
            <span className="vars-muted">nothing</span>
          )
        }
      />
      <Field
        label="Status"
        value={
          computed && !computed.ok ? (
            <span className="vars-field-error" data-testid="computed-status" role="alert">
              {computed.error}
            </span>
          ) : (
            <span data-testid="computed-status" className="vars-ok">
              OK
            </span>
          )
        }
      />
    </>
  )
}

function HistoryPanel({ source, id }: { source: VariablesSource; id: string }) {
  const entries = useAsyncList(() => source.history?.(id), [source, id])
  if (entries === undefined) return <p className="vars-muted">Loading history…</p>
  if (entries.length === 0) return <p className="vars-empty">No recorded history.</p>
  return (
    <ol className="vars-history-list" data-testid="inspector-history">
      {entries.map((e, i) => (
        <li key={`${e.ts}-${i}`} className="vars-history-entry">
          <span className="vars-history-when">{absolute(e.ts)}</span>
          <span className="vars-history-value">{stringifyValue(e.value)}</span>
          <span className="vars-history-source" data-source={e.source}>
            {e.source}
          </span>
        </li>
      ))}
    </ol>
  )
}

function RefsPanel({ source, id }: { source: VariablesSource; id: string }) {
  const refs = useAsyncList(() => source.references?.(id), [source, id])
  const env = useVariablesEnvOptional()
  if (refs === undefined) return <p className="vars-muted">Loading references…</p>
  if (refs.length === 0) return <p className="vars-empty">Not referenced anywhere.</p>
  const wired = env !== null
  return (
    <ul className="vars-ref-list" data-testid="inspector-refs">
      {refs.map((ref) => (
        <li key={`${ref.workspace}:${ref.targetId}`}>
          <button
            type="button"
            className="vars-ref-btn"
            data-testid={`ref-${ref.workspace}-${ref.targetId}`}
            disabled={!wired}
            title={wired ? `Open in ${ref.workspace}` : 'Navigation is not wired in this shell'}
            onClick={() => env?.navigate(ref)}
          >
            <span className="vars-ref-kind">{ref.kind}</span>
            <span className="vars-ref-label">{ref.label}</span>
            {ref.via ? <span className="vars-ref-via"> · {ref.via}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="vars-detail-row">
      <dt className="vars-detail-label">{label}</dt>
      <dd className="vars-detail-value">{value}</dd>
    </div>
  )
}

/** Fetch an optional async list once per dep change; undefined while loading. */
function useAsyncList<T>(fetcher: () => Promise<T[]> | undefined, deps: unknown[]): T[] | undefined {
  const [items, setItems] = useState<T[] | undefined>(undefined)
  useEffect(() => {
    let live = true
    const promise = fetcher()
    if (!promise) {
      setItems([])
      return
    }
    setItems(undefined)
    void promise.then((result) => {
      if (live) setItems(result)
    })
    return () => {
      live = false
    }
  }, deps)
  return items
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function absolute(ts: number): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? String(ts) : d.toISOString().replace('T', ' ').slice(0, 19)
}
