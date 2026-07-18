// React bindings for the Flows workspace (CD-409). The FlowModel is the single
// source of truth (the DOM never is); these hooks give the same render granularity
// the authoring canvas gets from use-project-model (CD-303):
//   • useFlowIds re-renders the tab strip ONLY on structural changes,
//   • useFlow re-renders one flow's views ONLY when that flow's id is dirty,
//   • useGraphNodes re-renders the graph surface only when its flow changes.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react'
import { LocalStorageAdapter } from '@/services/persistence'
import { FlowsService, localFlowsPersistence, type FlowsStatus, type SaveState } from './flows-service'
import type { FlowDocument, FlowEdge, FlowModel, GraphNode } from './flow-model'

const FlowsContext = createContext<FlowsService | null>(null)
export const FlowsProvider = FlowsContext.Provider

/** The injected service, or null when the pane runs on the default one. */
export function useFlowsOptional(): FlowsService | null {
  return useContext(FlowsContext)
}

export function useFlowsService(): FlowsService {
  const service = useContext(FlowsContext)
  if (!service) throw new Error('useFlowsService must be used within a FlowsProvider')
  return service
}

// The pane's fallback service. The composition root does not own a gateway yet
// (boot-sequence.ts constructs no repositories), so the workspace persists through
// the same StorageAdapter as the rest of the kernel. Module-level so switching
// workspaces away and back keeps the loaded model instead of re-reading it.
let fallback: FlowsService | null = null

export function defaultFlowsService(): FlowsService {
  fallback ??= new FlowsService({ persistence: localFlowsPersistence(new LocalStorageAdapter()) })
  return fallback
}

/** Service status + save state; re-renders on either changing. */
export function useFlowsState(service: FlowsService): { status: FlowsStatus; saveState: SaveState } {
  const subscribe = useCallback((cb: () => void) => service.subscribe(cb), [service])
  const rev = useSyncExternalStore(subscribe, () => service.stateRev)
  return useMemo(
    () => ({ status: service.status, saveState: service.saveState }),
    [service, rev],
  )
}

/** Flow ids in tab order; updates on structural changes (new/removed flow). */
export function useFlowIds(model: FlowModel): string[] {
  const subscribe = useCallback((cb: () => void) => model.subscribe((c) => c.structural && cb()), [model])
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev)
  return useMemo(() => model.list().map((f) => f.id), [model, rev])
}

/** One flow's current document; re-reads only when that flow's id is dirty. */
export function useFlow(model: FlowModel, id: string): FlowDocument | undefined {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => c.dirtyIds.includes(id) && cb()),
    [model, id],
  )
  const ver = useSyncExternalStore(subscribe, () => model.version(id))
  return useMemo(() => model.flow(id), [model, id, ver])
}

/** The flow's drawable nodes (trigger root + document nodes), recomputed when the
 *  flow's structure or any of its nodes change. */
export function useGraphNodes(model: FlowModel, flowId: string): GraphNode[] {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => (c.structural || c.dirtyIds.includes(flowId)) && cb()),
    [model, flowId],
  )
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev + model.version(flowId))
  return useMemo(() => model.graphNodes(flowId), [model, flowId, rev])
}

/** The flow's edges; re-reads when the flow's structure or nodes change (CD-411). */
export function useGraphEdges(model: FlowModel, flowId: string): readonly FlowEdge[] {
  const subscribe = useCallback(
    (cb: () => void) => model.subscribe((c) => (c.structural || c.dirtyIds.includes(flowId)) && cb()),
    [model, flowId],
  )
  const rev = useSyncExternalStore(subscribe, () => model.structuralRev + model.version(flowId))
  return useMemo(() => model.flow(flowId)?.edges ?? [], [model, flowId, rev])
}
