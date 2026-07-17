// Value cell (CD-402): inline edit + secret masking.
//
// Editing follows the layers-tree contract (CD-310): double-click (or Enter on the
// row) opens the editor, Enter/blur commits, Esc cancels. The editor rendered comes
// from the type's `editor` in VARIABLE_TYPES — adding a type is a table row.
//
// Secrets are masked at the SOURCE: a query payload carries `value: null` for them,
// so the cell has nothing to print until a hold fetches it (variables.get). That is
// what makes "never in the DOM until reveal" a property of the data flow rather than
// a CSS trick — there is no hidden node holding the plaintext.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  formatRaw,
  formatValue,
  isDerivedScope,
  isReadOnly,
  parseValue,
  readOnlyReason,
  typeMeta,
  type VariableRecord,
} from './variables-model'
import type { VariablesController } from './variables-controller'
import { useVariablesState } from './use-variables'

export const MASK = '••••••••'

export interface ValueCellProps {
  controller: VariablesController
  row: VariableRecord
  /** This row's value editor is open (the pane owns the one-at-a-time rule). */
  editing: boolean
  onBeginEdit: () => void
  onEndEdit: () => void
}

export function ValueCell(props: ValueCellProps) {
  if (isDerivedScope(props.row.scope)) return <DerivedCell {...props} />
  if (props.row.type === 'secret') return <SecretCell {...props} />
  if (props.editing && !isReadOnly(props.row)) return <ValueEditor {...props} />
  return <ReadOnlyOrIdle {...props} />
}

/**
 * Computed/expression value (CD-403). Not editable — the expression is edited
 * elsewhere — so the cell shows the LIVE engine evaluation (state.computed), which
 * re-renders on every dependency tick. A cyclic/invalid expression resolves to an
 * error result and shows an honest "⚠ error" marker whose reason rides in the title.
 */
function DerivedCell({ controller, row }: ValueCellProps) {
  const result = useVariablesState(controller, (s) => s.computed[row.id])
  const reason = 'Derived from an expression — edit the expression instead'
  return (
    <span
      className="vars-value-text"
      data-testid={`value-${row.id}`}
      data-readonly
      data-computed={result ? (result.ok ? 'ok' : 'error') : 'pending'}
      title={result && !result.ok ? result.error : reason}
    >
      {!result
        ? formatValue(row) // engine not wired / first eval pending: stored snapshot
        : result.ok
          ? formatRaw(result.value, row.type)
          : '⚠ error'}
      <span className="vars-lock" aria-label={reason} role="img">
        ƒ
      </span>
    </span>
  )
}

function ReadOnlyOrIdle({ row, onBeginEdit }: ValueCellProps) {
  const locked = isReadOnly(row)
  const reason = locked ? readOnlyReason(row) : undefined
  return (
    <span
      className="vars-value-text"
      data-testid={`value-${row.id}`}
      data-readonly={locked || undefined}
      title={reason}
      onDoubleClick={locked ? undefined : onBeginEdit}
    >
      {formatValue(row)}
      {locked ? (
        // Not a control — a signpost. The honest reason rides along in the title
        // and the inspector, so nothing here is silently inert.
        <span className="vars-lock" aria-label={reason} role="img">
          🔒
        </span>
      ) : null}
    </span>
  )
}

function ValueEditor({ controller, row, onEndEdit }: ValueCellProps) {
  const meta = typeMeta(row.type)
  const [draft, setDraft] = useState(() => initialDraft(row))
  const [error, setError] = useState<string>()
  const ref = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    if (ref.current instanceof HTMLInputElement) ref.current.select()
  }, [])

  const commit = (raw: string): void => {
    const parsed = parseValue(raw, row.type)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    onEndEdit()
    void controller.writeValue(row.id, parsed.value)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && row.type !== 'json' && row.type !== 'list' && row.type !== 'series') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      // Esc cancels: nothing is written, the row keeps the value it had.
      onEndEdit()
    }
  }

  const shared = {
    'data-testid': `edit-${row.id}`,
    'aria-label': `Value of ${row.name}`,
    'aria-invalid': error ? true : undefined,
    className: 'vars-input vars-value-input',
    onKeyDown,
    onBlur: () => commit(draft),
  }

  if (meta?.editor === 'checkbox') {
    return (
      <span className="vars-value-edit">
        <input
          {...shared}
          ref={ref as React.RefObject<HTMLInputElement>}
          type="checkbox"
          checked={draft === 'true'}
          onBlur={undefined}
          onChange={(e) => {
            const next = e.target.checked ? 'true' : 'false'
            setDraft(next)
            commit(next)
          }}
        />
      </span>
    )
  }

  if (meta?.editor === 'select') {
    return (
      <span className="vars-value-edit">
        <select
          {...shared}
          ref={ref as React.RefObject<HTMLSelectElement>}
          value={draft}
          onBlur={undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            commit(e.target.value)
          }}
        >
          {(row.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </span>
    )
  }

  if (meta?.editor === 'textarea') {
    return (
      <span className="vars-value-edit">
        <textarea
          {...shared}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        {error ? <ErrorHint id={row.id} text={error} /> : null}
      </span>
    )
  }

  return (
    <span className="vars-value-edit">
      <input
        {...shared}
        ref={ref as React.RefObject<HTMLInputElement>}
        type={meta?.editor === 'number' ? 'number' : meta?.editor === 'color' ? 'color' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {error ? <ErrorHint id={row.id} text={error} /> : null}
    </span>
  )
}

function ErrorHint({ id, text }: { id: string; text: string }) {
  return (
    <span className="vars-value-error" role="alert" data-testid={`edit-error-${id}`}>
      {text}
    </span>
  )
}

/**
 * Masked secret. Hold the button (pointer or Enter/Space) to fetch + show; release
 * re-masks. Copy is blocked by default — a secret you can select and paste anywhere
 * is not masked in any useful sense.
 */
function SecretCell({ controller, row, editing, onBeginEdit, onEndEdit }: ValueCellProps) {
  const revealed = useVariablesState(controller, (s) => row.id in s.revealed)
  const value = useVariablesState(controller, (s) => s.revealed[row.id])
  const locked = isReadOnly(row)

  // Never leave a secret on screen once the cell goes away.
  useEffect(() => () => controller.hideSecret(row.id), [controller, row.id])

  if (editing && !locked) return <ValueEditor controller={controller} row={row} editing onBeginEdit={onBeginEdit} onEndEdit={onEndEdit} />

  return (
    <span
      className="vars-secret"
      data-testid={`value-${row.id}`}
      onDoubleClick={locked ? undefined : onBeginEdit}
      onCopy={(e) => e.preventDefault()}
      title={locked ? readOnlyReason(row) : 'Hold to reveal · double-click to replace'}
    >
      <span className="vars-secret-value" data-revealed={revealed || undefined}>
        {revealed ? formatRaw(value, 'string') : MASK}
      </span>
      <button
        type="button"
        className="vars-reveal"
        data-testid={`reveal-${row.id}`}
        aria-label={`Hold to reveal ${row.name}`}
        aria-pressed={revealed}
        onPointerDown={() => void controller.revealSecret(row.id)}
        onPointerUp={() => controller.hideSecret(row.id)}
        onPointerLeave={() => controller.hideSecret(row.id)}
        onBlur={() => controller.hideSecret(row.id)}
        // Keyboard hold: key-repeat keeps it revealed, keyup re-masks.
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void controller.revealSecret(row.id)
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') controller.hideSecret(row.id)
        }}
      >
        {revealed ? '🙈' : '👁'}
      </button>
    </span>
  )
}

/** A secret's editor never prefills the old value — you replace it, you don't read it. */
function initialDraft(row: VariableRecord): string {
  if (row.type === 'secret') return ''
  if (row.type === 'boolean') return row.value ? 'true' : 'false'
  if (row.value === null || row.value === undefined) return ''
  if (row.type === 'json' || row.type === 'list' || row.type === 'series') {
    try {
      return JSON.stringify(row.value)
    } catch {
      return ''
    }
  }
  return String(row.value)
}
