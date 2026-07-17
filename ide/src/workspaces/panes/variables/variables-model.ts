// Variables domain model (CD-401). The record shape the workspace renders and the
// two vocabularies it is indexed by: the SCOPE rail (where a variable comes from)
// and the design's 13 TYPES (what it holds). Both are data — the rail, the type
// picker and the inspector all render from these tables, never from hardcoded lists.

/** Scope rail order (CD-401): the source a variable belongs to. */
export type VariableScope =
  | 'global'
  | 'page'
  | 'runtime'
  | 'computed'
  | 'expression'
  | 'environment'
  | 'plugin'
  | 'system'

export interface ScopeMeta {
  id: VariableScope
  label: string
  /** Rail hint — why this scope exists (tooltip + inspector). */
  hint: string
  /** Scopes the engine owns: values are observed, never authored here. */
  readOnly?: boolean
}

export const SCOPES: readonly ScopeMeta[] = [
  { id: 'global', label: 'Global', hint: 'Project-wide values you author' },
  { id: 'page', label: 'Page', hint: 'Scoped to a single page' },
  { id: 'runtime', label: 'Runtime', hint: 'Written by flows while the deck runs' },
  { id: 'computed', label: 'Computed', hint: 'Derived from other variables (CD-403)' },
  { id: 'expression', label: 'Expression', hint: 'Sandboxed expression, re-evaluated on dependency change' },
  { id: 'environment', label: 'Environment', hint: 'Host environment / .env values', readOnly: true },
  { id: 'plugin', label: 'Plugin', hint: 'Owned by a plugin — read-only here', readOnly: true },
  { id: 'system', label: 'System', hint: 'Engine telemetry (cpu/gpu/fps…)', readOnly: true },
]

const SCOPE_BY_ID = new Map(SCOPES.map((s) => [s.id, s]))

export function scopeMeta(id: VariableScope): ScopeMeta | undefined {
  return SCOPE_BY_ID.get(id)
}

/** The two scopes whose value is an expression rather than a literal (CD-403). */
export const DERIVED_SCOPES: readonly VariableScope[] = ['computed', 'expression']

export function isDerivedScope(scope: VariableScope): boolean {
  return DERIVED_SCOPES.includes(scope)
}

/**
 * The design's 13 variable types. The engine's state store is narrower today
 * (scalar/text/boolean/enum/series — `engine/core/state`); the extra IDE types
 * carry their own editor + formatter and degrade to a primitive on the wire, which
 * is the gap 02_Codebase_Assessment §1 calls out ("richer variable types").
 */
export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'percent'
  | 'duration'
  | 'datetime'
  | 'series'
  | 'json'
  | 'list'
  | 'secret'
  | 'reference'

export interface TypeMeta {
  id: VariableType
  label: string
  /** Editor the inline edit / New Variable dialog renders for this type. */
  editor: 'text' | 'number' | 'checkbox' | 'select' | 'color' | 'textarea'
  /** Default value for a freshly created variable of this type. */
  initial: unknown
  /** Never leaves the source in a list payload; revealed on demand (CD-402). */
  masked?: boolean
}

export const VARIABLE_TYPES: readonly TypeMeta[] = [
  { id: 'string', label: 'String', editor: 'text', initial: '' },
  { id: 'number', label: 'Number', editor: 'number', initial: 0 },
  { id: 'boolean', label: 'Boolean', editor: 'checkbox', initial: false },
  { id: 'enum', label: 'Enum', editor: 'select', initial: '' },
  { id: 'color', label: 'Color', editor: 'color', initial: '#4c9aff' },
  { id: 'percent', label: 'Percent', editor: 'number', initial: 0 },
  { id: 'duration', label: 'Duration (ms)', editor: 'number', initial: 0 },
  { id: 'datetime', label: 'Date / Time', editor: 'text', initial: '' },
  { id: 'series', label: 'Series', editor: 'textarea', initial: [] },
  { id: 'json', label: 'JSON', editor: 'textarea', initial: {} },
  { id: 'list', label: 'List', editor: 'textarea', initial: [] },
  { id: 'secret', label: 'Secret', editor: 'text', initial: '', masked: true },
  { id: 'reference', label: 'Reference', editor: 'text', initial: '' },
]

const TYPE_BY_ID = new Map(VARIABLE_TYPES.map((t) => [t.id, t]))

export function typeMeta(id: VariableType): TypeMeta | undefined {
  return TYPE_BY_ID.get(id)
}

/** One row of the table / one node of the bindable variable tree. */
export interface VariableRecord {
  /** The bindable path — `sys.cpu.load`. Also the repository id. */
  id: string
  name: string
  scope: VariableScope
  type: VariableType
  /** Current value. `null` for a masked secret until revealed (CD-402). */
  value: unknown
  /** Owning plugin id — set (and only set) for scope='plugin'. */
  plugin?: string
  /** Sandboxed expression source for computed/expression scopes (CD-403). */
  expr?: string
  /** Unix ms of the last write (inspector history + `updated` sort). */
  updatedAt?: number
  description?: string
  /** Enum members, when type='enum'. */
  options?: string[]
}

/**
 * True when the workspace must not author this row: plugin/system/environment
 * scopes are owned elsewhere, and derived rows are edited as an expression
 * (CD-403) rather than as a value.
 */
export function isReadOnly(v: VariableRecord): boolean {
  return Boolean(scopeMeta(v.scope)?.readOnly) || isDerivedScope(v.scope)
}

/** Honest reason a row's value editor is disabled — surfaced on the control. */
export function readOnlyReason(v: VariableRecord): string | undefined {
  if (v.scope === 'plugin') return `Owned by plugin "${v.plugin ?? 'unknown'}" — edit it in the plugin's settings`
  if (v.scope === 'system') return 'Engine telemetry — the engine is the only writer'
  if (v.scope === 'environment') return 'Host environment value — set it in the environment, not here'
  if (isDerivedScope(v.scope)) return 'Derived from an expression — edit the expression instead'
  return undefined
}

/** Display string for a value cell. Masked secrets never format their value. */
export function formatValue(v: VariableRecord): string {
  if (v.type === 'secret') return '••••••••'
  return formatRaw(v.value, v.type)
}

/** Format an already-unmasked raw value for display. */
export function formatRaw(value: unknown, type: VariableType): string {
  if (value === null || value === undefined) return '—'
  switch (type) {
    case 'percent':
      return typeof value === 'number' ? `${value}%` : String(value)
    case 'duration':
      return typeof value === 'number' ? formatDuration(value) : String(value)
    case 'datetime':
      return formatDateTime(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'series':
    case 'list':
      return Array.isArray(value) ? `[${value.length}] ${value.slice(0, 4).join(', ')}${value.length > 4 ? '…' : ''}` : String(value)
    case 'json':
      return safeJson(value)
    default:
      return String(value)
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${round(ms / 1000)} s`
  return `${round(ms / 60_000)} min`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function formatDateTime(value: unknown): string {
  const d = typeof value === 'number' || typeof value === 'string' ? new Date(value) : null
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().replace('T', ' ').slice(0, 19) : String(value)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Coerce a string from a text editor into the type's native value. Returns an
 * error message instead of a value when the input is not valid for the type —
 * the caller shows it inline and keeps the editor open.
 */
export function parseValue(raw: string, type: VariableType): { value: unknown } | { error: string } {
  switch (type) {
    case 'number':
    case 'percent':
    case 'duration': {
      const n = Number(raw)
      if (raw.trim() === '' || Number.isNaN(n)) return { error: 'Enter a number' }
      if (type === 'percent' && (n < 0 || n > 100)) return { error: 'Percent must be 0–100' }
      if (type === 'duration' && n < 0) return { error: 'Duration cannot be negative' }
      return { value: n }
    }
    case 'boolean':
      return { value: raw === 'true' || raw === '1' }
    case 'color':
      return /^#[0-9a-f]{6}$/i.test(raw.trim()) ? { value: raw.trim() } : { error: 'Enter a hex colour (#rrggbb)' }
    case 'datetime': {
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? { error: 'Enter a date/time' } : { value: raw }
    }
    case 'json':
    case 'list':
    case 'series': {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (type !== 'json' && !Array.isArray(parsed)) return { error: 'Enter a JSON array' }
        return { value: parsed }
      } catch {
        return { error: 'Invalid JSON' }
      }
    }
    default:
      return { value: raw }
  }
}

const PATH_RE = /^[a-z][a-z0-9]*(\.[a-z0-9_]+)*$/i

/** Validate a new variable's path/name pair (New Variable dialog, CD-402). */
export function validateDraft(
  draft: { id: string; name: string },
  existingIds: Iterable<string>,
): Partial<Record<'id' | 'name', string>> {
  const errors: Partial<Record<'id' | 'name', string>> = {}
  const id = draft.id.trim()
  if (!id) errors.id = 'Path is required'
  else if (!PATH_RE.test(id)) errors.id = 'Use dot.separated.segments (letters, digits, _)'
  else if ([...existingIds].includes(id)) errors.id = `"${id}" already exists`
  if (!draft.name.trim()) errors.name = 'Name is required'
  return errors
}
