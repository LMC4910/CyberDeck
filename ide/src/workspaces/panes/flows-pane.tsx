// Flows pane (CD-203 → CD-409 model/tabs/armed). Composes the Flows workspace: the
// FlowsService loads the flow collection through its persistence seam and owns the
// FlowModel; the tab strip switches/renames/creates flows and arms the active one.
// The graph surface + node library land at CD-410. Its own chunk via import().
import { useEffect, useMemo, useState } from 'react'
import { useUndo } from './deck-designer/use-undo'
import { FlowTabs } from './flows/flow-tabs'
import { defaultFlowsService, useFlowIds, useFlowsOptional, useFlowsState } from './flows/use-flows'
import type { FlowsCtx } from './flows/flow-ops'
import type { FlowModel } from './flows/flow-model'
import type { FlowsService } from './flows/flows-service'
import './flows/flows.css'

export default function FlowsPane() {
  // The composition root wires no gateway yet, so the pane falls back to the shared
  // local-persistence service; a FlowsProvider (tests, and the M5 swap) overrides it.
  const injected = useFlowsOptional()
  const service = useMemo(() => injected ?? defaultFlowsService(), [injected])
  const { status } = useFlowsState(service)

  useEffect(() => {
    void service.load()
  }, [service])

  const model = service.model
  if (!model) {
    return (
      <section className="fw-pane" data-pane="flows" data-status={status} aria-label="Flows workspace">
        <p className="fw-empty">{status === 'error' ? 'Flows could not be loaded.' : 'Loading flows…'}</p>
      </section>
    )
  }
  return <FlowsWorkspace service={service} model={model} />
}

function FlowsWorkspace({ service, model }: { service: FlowsService; model: FlowModel }) {
  const undo = useUndo()
  const ctx = useMemo<FlowsCtx>(() => ({ model, undo, service }), [model, undo, service])
  const ids = useFlowIds(model)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Derived, not stored: undoing a "New flow" (or any removal) drops the selection
  // back to the first tab without an effect racing the render.
  const activeId = selectedId && ids.includes(selectedId) ? selectedId : (ids[0] ?? null)

  return (
    <section className="fw-pane" data-pane="flows" data-status="ready" aria-label="Flows workspace">
      <FlowTabs ctx={ctx} activeId={activeId} onActivate={setSelectedId} />
      {activeId ? (
        <p className="fw-empty">The flow graph arrives in CD-410.</p>
      ) : (
        <p className="fw-empty">No flows yet — use + to create one.</p>
      )}
    </section>
  )
}
