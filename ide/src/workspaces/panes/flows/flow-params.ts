// Per-kind param schemas (CD-413). The flow document's `node.params` / `trigger.config`
// are open bags in the CD-112 schema ("per-kind schemas registered by the node
// catalog"); this is that registry on the IDE side. The inspector generates its fields
// from here, so adding a field is editing this table — never the inspector component.
// Kept deliberately in step with the engine's node param names (FLOW_MAPPING.md).
import type { TriggerKind } from './flow-model'
import type { NodeKind } from './flow-model'

export type ParamFieldType = 'text' | 'number' | 'boolean' | 'select'

export interface ParamField {
  key: string
  label: string
  type: ParamFieldType
  /** Options for `select` fields. */
  options?: readonly string[]
  placeholder?: string
}

/** Fields every action node shares (CD-413: action retry/delay/timeout/await). */
const ACTION_FIELDS: readonly ParamField[] = [
  { key: 'retry', label: 'Retry count', type: 'number', placeholder: '0' },
  { key: 'delay', label: 'Delay (ms)', type: 'number', placeholder: '0' },
  { key: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '0' },
  { key: 'await', label: 'Await completion', type: 'boolean' },
]

/** Authoring fields per node kind. Every kind in NODE_CATALOG has an entry so the
 *  inspector can render *something* for each (AC: every kind renders its fields). */
export const NODE_PARAM_FIELDS: Record<NodeKind, readonly ParamField[]> = {
  'logic.condition': [
    { key: 'op', label: 'Operator', type: 'select', options: ['==', '!=', '<', '<=', '>', '>=', 'contains'] },
    { key: 'match', label: 'Match value', type: 'text' },
    { key: 'negate', label: 'Negate', type: 'boolean' },
  ],
  'logic.branch': [{ key: 'expr', label: 'Expression', type: 'text' }],
  'logic.delay': [{ key: 'delay', label: 'Delay (ms)', type: 'number', placeholder: '250' }],
  'logic.gate': [{ key: 'openWhen', label: 'Open when', type: 'text' }],
  'data.math': [{ key: 'expr', label: 'Expression', type: 'text' }],
  'data.text': [{ key: 'template', label: 'Template', type: 'text' }],
  'data.datetime': [{ key: 'format', label: 'Format', type: 'text', placeholder: 'YYYY-MM-DD HH:mm' }],
  'integration.obs': [{ key: 'scene', label: 'Scene', type: 'text' }],
  'integration.spotify': [
    { key: 'action', label: 'Action', type: 'select', options: ['play', 'pause', 'next', 'previous'] },
  ],
  'integration.http': [
    { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
    { key: 'url', label: 'URL', type: 'text', placeholder: 'https://…' },
  ],
  'integration.mqtt': [
    { key: 'topic', label: 'Topic', type: 'text' },
    { key: 'payload', label: 'Payload', type: 'text' },
  ],
  'action.command': [{ key: 'command', label: 'Command', type: 'text' }, ...ACTION_FIELDS],
  'action.notify': [
    { key: 'message', label: 'Message', type: 'text' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high'] },
    ...ACTION_FIELDS,
  ],
  'action.setVariable': [
    { key: 'variable', label: 'Variable', type: 'text' },
    { key: 'value', label: 'Value', type: 'text' },
    ...ACTION_FIELDS,
  ],
  'action.setState': [
    { key: 'stateId', label: 'State', type: 'text' },
    { key: 'value', label: 'Value', type: 'text' },
    ...ACTION_FIELDS,
  ],
  'action.runFlow': [{ key: 'flowId', label: 'Flow', type: 'text' }, ...ACTION_FIELDS],
  'structure.group': [
    { key: 'groupMode', label: 'Group mode', type: 'select', options: ['sequence', 'parallel'] },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  'structure.comment': [{ key: 'text', label: 'Comment', type: 'text' }],
  'structure.subflow': [{ key: 'flowId', label: 'Subflow', type: 'text' }],
}

/** Authoring fields per trigger kind (CD-413: trigger debounce/once). Schema-aligned
 *  with flow.schema.json's trigger.config (event→event, stateChange→expr/stateId/debounce). */
export const TRIGGER_PARAM_FIELDS: Record<TriggerKind, readonly ParamField[]> = {
  manual: [],
  event: [
    { key: 'event', label: 'Event', type: 'text', placeholder: 'obs.streaming.started' },
    { key: 'once', label: 'Fire once', type: 'boolean' },
  ],
  stateChange: [
    { key: 'expr', label: 'Expression', type: 'text' },
    { key: 'stateId', label: 'State', type: 'text' },
    { key: 'debounce', label: 'Debounce (ms)', type: 'number', placeholder: '250' },
  ],
  schedule: [
    { key: 'cron', label: 'Cron', type: 'text', placeholder: '0 */5 * * *' },
    { key: 'interval', label: 'Interval (ms)', type: 'number' },
  ],
}

/** Fields for a node kind (empty for an unknown/plugin kind — renders "no parameters"). */
export function fieldsForNodeKind(kind: string): readonly ParamField[] {
  return NODE_PARAM_FIELDS[kind as NodeKind] ?? []
}

/** Coerce a raw form value to the field's type for storage (numbers as numbers, etc.).
 *  An empty text/number clears the key (stored bag stays minimal). */
export function coerceParam(field: ParamField, raw: string | boolean): unknown {
  if (field.type === 'boolean') return raw === true || raw === 'true'
  if (field.type === 'number') {
    if (raw === '' || raw == null) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return raw === '' ? undefined : raw
}
