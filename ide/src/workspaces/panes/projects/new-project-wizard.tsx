// New-project wizard (CD-406). Template + name + device, validated inline, then
// create → open → land in Design.
//
// Semantics:
//   • Enter submits from any field (the form's implicit submit) — blocked, with the
//     first error focused, while the input is invalid.
//   • Esc cancels; if anything has been typed or picked, it asks first (dirty-guard)
//     rather than silently dropping the work. An untouched wizard just closes.
//   • Errors are inline, tied to their field with aria-describedby + aria-invalid,
//     and announced — never a toast, never a silently disabled button.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Dialog } from '@/shared/a11y'
import { ConfirmDialog } from './confirm-dialog'
import { buildProject, DEVICE_TARGETS, PROJECT_TEMPLATES } from './templates'
import type { ProjectRecord } from '@/services/project'

export const NAME_MAX = 60

export interface NewProjectWizardProps {
  open: boolean
  /** Template pre-picked by a dashboard card, if any. */
  initialTemplateId?: string
  /** Names already in use — a project name has to be tellable apart from its siblings. */
  takenNames: readonly string[]
  onCancel: () => void
  onCreate: (record: ProjectRecord) => void
}

export interface WizardValues {
  name: string
  templateId: string
  deviceId: string
}

export type WizardErrors = Partial<Record<'name' | 'deviceId' | 'templateId', string>>

/** Pure validation — the wizard's rules, testable without a DOM. */
export function validateWizard(values: WizardValues, takenNames: readonly string[]): WizardErrors {
  const errors: WizardErrors = {}
  const name = values.name.trim()
  if (!name) errors.name = 'Give the project a name.'
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`
  else if (takenNames.some((t) => t.toLowerCase() === name.toLowerCase())) {
    errors.name = 'A project with that name already exists.'
  }
  if (!values.deviceId) errors.deviceId = 'Choose a target device.'
  else if (!DEVICE_TARGETS.some((d) => d.id === values.deviceId)) errors.deviceId = 'Unknown device.'
  if (!values.templateId) errors.templateId = 'Choose a template.'
  else if (!PROJECT_TEMPLATES.some((t) => t.id === values.templateId)) errors.templateId = 'Unknown template.'
  return errors
}

const EMPTY: WizardValues = { name: '', templateId: 'blank', deviceId: '' }

export function NewProjectWizard({
  open,
  initialTemplateId,
  takenNames,
  onCancel,
  onCreate,
}: NewProjectWizardProps) {
  const [values, setValues] = useState<WizardValues>(EMPTY)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const baseId = useId()

  // Each opening is a fresh wizard, seeded with the card the user clicked.
  useEffect(() => {
    if (!open) return
    setValues({ ...EMPTY, templateId: initialTemplateId ?? EMPTY.templateId })
    setShowErrors(false)
    setConfirmDiscard(false)
    nameRef.current?.focus()
  }, [open, initialTemplateId])

  const errors = useMemo(() => validateWizard(values, takenNames), [values, takenNames])
  const dirty = values.name.trim() !== '' || values.deviceId !== ''

  const requestCancel = () => {
    if (dirty) setConfirmDiscard(true)
    else onCancel()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (Object.keys(errors).length > 0) {
      // Blocked: surface the errors and put focus on the first offending field.
      setShowErrors(true)
      if (errors.name) nameRef.current?.focus()
      return
    }
    onCreate(buildProject(values.templateId, { name: values.name.trim(), deviceId: values.deviceId }))
  }

  const err = (field: keyof WizardErrors) => (showErrors ? errors[field] : undefined)
  const fieldId = (field: string) => `${baseId}-${field}`
  const errorId = (field: string) => `${baseId}-${field}-error`

  return (
    <>
      <Dialog open={open} onClose={requestCancel} label="New project">
        <form className="pj-wizard" onSubmit={submit} data-testid="new-project-wizard" noValidate>
          <h2 className="pj-wizard-title">New project</h2>

          <fieldset className="pj-wizard-field">
            <legend className="pj-field-label">Template</legend>
            <div className="pj-wizard-templates">
              {PROJECT_TEMPLATES.map((t) => (
                <label key={t.id} className="pj-wizard-template" data-picked={values.templateId === t.id || undefined}>
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={values.templateId === t.id}
                    onChange={() => setValues((v) => ({ ...v, templateId: t.id }))}
                  />
                  <span className="pj-template-label">{t.label}</span>
                  <span className="pj-template-desc">{t.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="pj-wizard-field">
            <label className="pj-field-label" htmlFor={fieldId('name')}>
              Name
            </label>
            <input
              ref={nameRef}
              id={fieldId('name')}
              className="pj-input"
              value={values.name}
              maxLength={NAME_MAX + 20}
              autoComplete="off"
              aria-invalid={err('name') ? true : undefined}
              aria-describedby={err('name') ? errorId('name') : undefined}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
            {err('name') && (
              <p className="pj-field-error" id={errorId('name')} role="alert" data-testid="error-name">
                {err('name')}
              </p>
            )}
          </div>

          <div className="pj-wizard-field">
            <label className="pj-field-label" htmlFor={fieldId('device')}>
              Target device
            </label>
            <select
              id={fieldId('device')}
              className="pj-input"
              value={values.deviceId}
              aria-invalid={err('deviceId') ? true : undefined}
              aria-describedby={err('deviceId') ? errorId('device') : undefined}
              onChange={(e) => setValues((v) => ({ ...v, deviceId: e.target.value }))}
            >
              <option value="">Choose a device…</option>
              {DEVICE_TARGETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {err('deviceId') && (
              <p className="pj-field-error" id={errorId('device')} role="alert" data-testid="error-device">
                {err('deviceId')}
              </p>
            )}
          </div>

          <div className="pj-wizard-actions">
            <button type="button" className="pj-btn" onClick={requestCancel}>
              Cancel
            </button>
            <button type="submit" className="pj-btn pj-btn-primary" data-testid="wizard-create">
              Create project
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard new project?"
        body="The name and options you entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onCancel()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  )
}
