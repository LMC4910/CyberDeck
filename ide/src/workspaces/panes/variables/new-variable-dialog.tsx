// New Variable dialog (CD-402). The type picker is generated from VARIABLE_TYPES —
// all 13 design types, each bringing its own initial value and editor. Built on the
// a11y Dialog primitive (focus-trapped, aria-modal, Esc closes); Enter submits.
import { useMemo, useState } from 'react'
import { Dialog } from '@/shared/a11y'
import {
  SCOPES,
  VARIABLE_TYPES,
  parseValue,
  typeMeta,
  validateDraft,
  type VariableScope,
  type VariableType,
} from './variables-model'
import type { VariableDraft } from './variables-source'

/** Scopes a person may author into. The rest are owned by the engine/plugins. */
const CREATABLE_SCOPES = SCOPES.filter((s) => !s.readOnly && s.id !== 'computed' && s.id !== 'expression')

export interface NewVariableDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (draft: VariableDraft) => void
  /** Ids already known, for the duplicate check (the source is the final word). */
  existingIds: string[]
  /** Scope preselected from the rail. */
  defaultScope?: VariableScope
}

export function NewVariableDialog({ open, onClose, onCreate, existingIds, defaultScope }: NewVariableDialogProps) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [scope, setScope] = useState<VariableScope>(defaultScope ?? 'global')
  const [type, setType] = useState<VariableType>('string')
  const [raw, setRaw] = useState('')
  const [description, setDescription] = useState('')
  const [touched, setTouched] = useState(false)

  const meta = typeMeta(type)
  const errors = useMemo(() => validateDraft({ id, name }, existingIds), [id, name, existingIds])
  const valueResult = useMemo(
    () => (raw.trim() === '' ? { value: meta?.initial } : parseValue(raw, type)),
    [raw, type, meta],
  )
  const valueError = 'error' in valueResult ? valueResult.error : undefined
  const invalid = Object.keys(errors).length > 0 || Boolean(valueError)

  const reset = (): void => {
    setId('')
    setName('')
    setType('string')
    setRaw('')
    setDescription('')
    setTouched(false)
  }

  const submit = (): void => {
    setTouched(true)
    if (invalid || 'error' in valueResult) return
    onCreate({
      id: id.trim(),
      name: name.trim(),
      scope,
      type,
      value: valueResult.value,
      ...(description.trim() ? { description: description.trim() } : {}),
    })
    reset()
    onClose()
  }

  const close = (): void => {
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <Dialog open={open} onClose={close} label="New Variable">
      <form
        className="vars-dialog"
        data-testid="new-variable-dialog"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <h2 className="vars-dialog-title">New Variable</h2>

        <Field label="Path" error={touched ? errors.id : undefined} hint="Bindable path, e.g. deck.mode">
          <input
            className="vars-input"
            data-testid="new-var-id"
            autoFocus
            value={id}
            aria-invalid={touched && errors.id ? true : undefined}
            onChange={(e) => setId(e.target.value)}
          />
        </Field>

        <Field label="Name" error={touched ? errors.name : undefined}>
          <input
            className="vars-input"
            data-testid="new-var-name"
            value={name}
            aria-invalid={touched && errors.name ? true : undefined}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Scope">
          <select
            className="vars-input"
            data-testid="new-var-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as VariableScope)}
          >
            {CREATABLE_SCOPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Type">
          <select
            className="vars-input"
            data-testid="new-var-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as VariableType)
              setRaw('') // the old literal rarely parses as the new type
            }}
          >
            {VARIABLE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Initial value"
          error={touched ? valueError : undefined}
          hint={raw.trim() === '' ? `Defaults to ${JSON.stringify(meta?.initial)}` : undefined}
        >
          <input
            className="vars-input"
            data-testid="new-var-value"
            type={meta?.editor === 'number' ? 'number' : meta?.editor === 'color' ? 'color' : 'text'}
            value={raw}
            aria-invalid={touched && valueError ? true : undefined}
            onChange={(e) => setRaw(e.target.value)}
          />
        </Field>

        <Field label="Description" hint="Optional">
          <input
            className="vars-input"
            data-testid="new-var-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="vars-dialog-actions">
          <button type="button" className="a11y-btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="a11y-btn vars-primary" data-testid="new-var-submit">
            Create
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="vars-dialog-field">
      <span className="vars-field-label">{label}</span>
      {children}
      {error ? (
        <span className="vars-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="vars-field-hint">{hint}</span>
      ) : null}
    </label>
  )
}
