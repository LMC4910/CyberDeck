// Variables workspace (CD-401 → CD-403). Scopes rail | virtualized table | inspector,
// all reading one VariablesSource (variables/variables-source.ts). The workspace may
// not import repositories, so the shell binds a VariablesRepository-backed adapter
// through VariablesSourceProvider; until it does, the pane serves the in-memory mock
// — the same M4/M5 swap `variables-catalog.ts` (CD-324) set up for bindings.
import { useState } from 'react'
import { ScopesRail } from './variables/scopes-rail'
import { VariablesTable } from './variables/variables-table'
import { VariablesToolbar } from './variables/variables-toolbar'
import { MockVariablesSource } from './variables/mock-variables-source'
import { useVariablesSourceOptional } from './variables/variables-source'
import { useVariablesController, useVariablesState } from './variables/use-variables'
import './variables/variables.css'

export default function VariablesPane() {
  const provided = useVariablesSourceOptional()
  const [fallback] = useState(() => new MockVariablesSource())
  const source = provided ?? fallback
  const controller = useVariablesController(source)

  const scope = useVariablesState(controller, (s) => s.filter.scope)
  const notice = useVariablesState(controller, (s) => s.notice)

  return (
    <section className="vars-pane" data-pane="variables" aria-label="Variables workspace">
      <ScopesRail value={scope} onChange={(next) => controller.setFilter({ scope: next })} />

      <div className="vars-main">
        <VariablesToolbar controller={controller} source={source} />
        <VariablesTable controller={controller} />
        {notice ? (
          <p className="vars-notice" data-kind={notice.kind} data-testid="vars-notice" role="status">
            {notice.text}
          </p>
        ) : null}
      </div>
    </section>
  )
}
