// Variables toolbar (CD-401). Search + plugin filter + the result readout. Every
// control here edits a *query param*; none of them touch rows. Actions (new/delete)
// are contributed by the pane from CD-402.
import { useEffect, useState, type ReactNode } from 'react'
import type { VariablesController } from './variables-controller'
import type { VariablesSource } from './variables-source'
import { useVariablesState } from './use-variables'

export interface VariablesToolbarProps {
  controller: VariablesController
  source: VariablesSource
  /** Row actions (New Variable, Delete…) rendered at the end of the bar. */
  actions?: ReactNode
}

export function VariablesToolbar({ controller, source, actions }: VariablesToolbarProps) {
  const search = useVariablesState(controller, (s) => s.filter.search ?? '')
  const plugin = useVariablesState(controller, (s) => s.filter.plugin ?? '')
  const total = useVariablesState(controller, (s) => s.total)
  const loading = useVariablesState(controller, (s) => s.loading)
  const [plugins, setPlugins] = useState<string[] | null>(null)

  // Facet options for the plugin filter. Absent on a source that cannot index
  // them → the control disables itself rather than showing an empty menu.
  useEffect(() => {
    let live = true
    if (!source.plugins) {
      setPlugins(null)
      return
    }
    void source.plugins().then((ids) => {
      if (live) setPlugins(ids)
    })
    return () => {
      live = false
    }
  }, [source])

  const pluginFilterUnavailable = !source.plugins

  return (
    <div className="vars-toolbar">
      <label className="vars-field">
        <span className="vars-field-label">Search</span>
        <input
          type="search"
          className="vars-search"
          data-testid="vars-search"
          placeholder="Name or path…"
          value={search}
          // Straight through to the query param: the controller drops superseded
          // responses, so a keystroke per query stays correct. A debounce belongs
          // here once a networked gateway replaces the in-memory mock (M5).
          onChange={(e) => controller.setFilter({ search: e.target.value })}
        />
      </label>

      <label className="vars-field">
        <span className="vars-field-label">Plugin</span>
        <select
          className="vars-plugin-filter"
          data-testid="vars-plugin-filter"
          value={plugin}
          disabled={pluginFilterUnavailable}
          title={pluginFilterUnavailable ? 'This source does not index plugin owners' : undefined}
          onChange={(e) => controller.setFilter({ plugin: e.target.value || undefined })}
        >
          <option value="">All plugins</option>
          {(plugins ?? []).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <span className="vars-count" data-testid="vars-count" aria-live="polite">
        {loading ? 'Loading…' : `${total.toLocaleString()} ${total === 1 ? 'variable' : 'variables'}`}
      </span>

      <div className="vars-toolbar-actions">{actions}</div>
    </div>
  )
}
