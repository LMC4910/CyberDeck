// Flow inspector (CD-413). The right column of the Flows workspace. What it shows is
// driven by the selection: a node → its per-kind param fields (generated from
// flow-params, never hand-listed); the trigger root → trigger kind + config fields; an
// edge → its branch; a multi-selection → a count; nothing → the flow's own meta. Every
// edit persists on the document through an undoable op (params round-trip, AC).
import { useFlow } from './use-flows'
import { TRIGGER_KINDS, TRIGGER_NODE_ID, type BranchLabel, type FlowEdge, type TriggerKind } from './flow-model'
import { labelForKind } from './flow-catalog'
import {
  NODE_PARAM_FIELDS,
  TRIGGER_PARAM_FIELDS,
  coerceParam,
  fieldsForNodeKind,
  type ParamField,
} from './flow-params'
import {
  deleteEdge,
  renameFlow,
  setEdgeBranch,
  setFlowArmed,
  setNodeParam,
  setTriggerKind,
  setTriggerParam,
  type FlowsCtx,
} from './flow-ops'
import { clearSelection, selectEdge, type FlowSelection } from './flow-selection'

/** Branch selectors offered in the edge inspector (flow.schema.json edge.label enum). */
const BRANCH_LABELS: readonly BranchLabel[] = ['always', 'true', 'false']

export interface FlowInspectorProps {
  ctx: FlowsCtx
  flowId: string
  selection: FlowSelection
  setSelection: (sel: FlowSelection) => void
}

export function FlowInspector({ ctx, flowId, selection, setSelection }: FlowInspectorProps) {
  const { model } = ctx
  // Subscribe so field values reflect edits (and undo) immediately.
  const doc = useFlow(model, flowId)
  if (!doc) return null

  if (selection.edge) {
    return <EdgeInspector ctx={ctx} flowId={flowId} edge={selection.edge} setSelection={setSelection} />
  }

  const nodeIds = [...selection.nodes]
  if (nodeIds.length > 1) {
    return (
      <aside className="fw-inspector" data-inspector="multi" aria-label="Flow inspector">
        <header className="fw-inspector__head">{nodeIds.length} nodes selected</header>
        <p className="fw-inspector__hint">⌘D duplicates · ⌫ deletes · drag to move together.</p>
      </aside>
    )
  }

  const only = nodeIds[0]
  if (only === TRIGGER_NODE_ID) {
    return <TriggerInspector ctx={ctx} flowId={flowId} />
  }
  if (only) {
    const node = model.node(flowId, only)
    if (node) return <NodeInspector ctx={ctx} flowId={flowId} nodeId={node.id} kind={node.kind} />
  }

  // Empty selection → the flow's own meta (empty-graph inspector).
  return (
    <aside className="fw-inspector" data-inspector="flow" aria-label="Flow inspector">
      <header className="fw-inspector__head">Flow</header>
      <label className="fw-field">
        <span>Name</span>
        <input type="text" value={doc.label} onChange={(e) => renameFlow(ctx, flowId, e.target.value)} />
      </label>
      <label className="fw-field fw-field--check">
        <input
          type="checkbox"
          checked={doc.armed ?? false}
          onChange={(e) => setFlowArmed(ctx, flowId, e.target.checked)}
        />
        <span>Armed</span>
      </label>
      <p className="fw-inspector__hint">Select a node to edit its parameters.</p>
    </aside>
  )
}

function NodeInspector({ ctx, flowId, nodeId, kind }: { ctx: FlowsCtx; flowId: string; nodeId: string; kind: string }) {
  const node = ctx.model.node(flowId, nodeId)
  const params = (node?.params ?? {}) as Record<string, unknown>
  const fields = fieldsForNodeKind(kind)
  return (
    <aside className="fw-inspector" data-inspector="node" data-node-kind={kind} aria-label="Flow inspector">
      <header className="fw-inspector__head">{labelForKind(kind)}</header>
      {fields.length === 0 ? (
        <p className="fw-inspector__hint" data-inspector-empty>
          This node has no parameters.
        </p>
      ) : (
        fields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={params[f.key]}
            onChange={(v) => setNodeParam(ctx, flowId, nodeId, f.key, coerceParam(f, v))}
          />
        ))
      )}
    </aside>
  )
}

function TriggerInspector({ ctx, flowId }: { ctx: FlowsCtx; flowId: string }) {
  const trigger = ctx.model.trigger(flowId)
  const kind = trigger?.kind ?? 'manual'
  const config = (trigger?.config ?? {}) as Record<string, unknown>
  const fields = TRIGGER_PARAM_FIELDS[kind]
  return (
    <aside className="fw-inspector" data-inspector="trigger" data-trigger-kind={kind} aria-label="Flow inspector">
      <header className="fw-inspector__head">Trigger</header>
      <label className="fw-field">
        <span>Type</span>
        <select value={kind} onChange={(e) => setTriggerKind(ctx, flowId, e.target.value as TriggerKind)}>
          {TRIGGER_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          value={config[f.key]}
          onChange={(v) => setTriggerParam(ctx, flowId, f.key, coerceParam(f, v))}
        />
      ))}
    </aside>
  )
}

function EdgeInspector({
  ctx,
  flowId,
  edge,
  setSelection,
}: {
  ctx: FlowsCtx
  flowId: string
  edge: FlowEdge
  setSelection: (sel: FlowSelection) => void
}) {
  return (
    <aside className="fw-inspector" data-inspector="edge" aria-label="Flow inspector">
      <header className="fw-inspector__head">Edge</header>
      <p className="fw-inspector__edge">
        {edge.from} → {edge.to}
      </p>
      <label className="fw-field">
        <span>Branch</span>
        <select
          value={edge.label ?? 'always'}
          onChange={(e) => {
            const next = setEdgeBranch(ctx, flowId, edge, e.target.value as BranchLabel)
            if (next) setSelection(selectEdge(next))
          }}
        >
          {BRANCH_LABELS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="fw-inspector__delete"
        onClick={() => {
          deleteEdge(ctx, flowId, edge)
          setSelection(clearSelection())
        }}
      >
        Delete edge
      </button>
    </aside>
  )
}

function FieldRow({ field, value, onChange }: { field: ParamField; value: unknown; onChange: (v: string | boolean) => void }) {
  const id = `fw-field-${field.key}`
  if (field.type === 'boolean') {
    return (
      <label className="fw-field fw-field--check" data-field={field.key}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        <span>{field.label}</span>
      </label>
    )
  }
  if (field.type === 'select') {
    return (
      <label className="fw-field" data-field={field.key}>
        <span>{field.label}</span>
        <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }
  return (
    <label className="fw-field" data-field={field.key}>
      <span>{field.label}</span>
      <input
        id={id}
        type={field.type === 'number' ? 'number' : 'text'}
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

// Re-export so the pane can render the whole param table in tests without deep imports.
export { NODE_PARAM_FIELDS }
