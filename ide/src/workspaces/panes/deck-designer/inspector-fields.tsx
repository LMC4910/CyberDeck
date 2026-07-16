// Reusable inspector field rows (CD-312). Labeled, keyboard-operable primitives the
// inspector sections compose. Each commits through a caller-provided onCommit that
// wraps the change in an undoable model command. Number/Text fields commit on blur
// or Enter (so typing doesn't spam the undo stack); toggles/selects/segmented commit
// immediately.
import { useEffect, useId, useState } from 'react'

export function FieldRow({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label className="dd-field" htmlFor={htmlFor}>
      <span className="dd-field-label">{label}</span>
      <span className="dd-field-control">{children}</span>
    </label>
  )
}

export function NumberField({ label, value, onCommit, step = 1 }: { label: string; value: number; onCommit: (v: number) => void; step?: number }) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const n = Number(draft)
    if (Number.isFinite(n) && n !== value) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <FieldRow label={label} htmlFor={id}>
      <input
        id={id}
        type="number"
        className="dd-input"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') setDraft(String(value))
        }}
      />
    </FieldRow>
  )
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <FieldRow label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        className="dd-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') setDraft(value)
        }}
      />
    </FieldRow>
  )
}

export function ToggleField({ label, value, onCommit }: { label: string; value: boolean; onCommit: (v: boolean) => void }) {
  const id = useId()
  return (
    <FieldRow label={label} htmlFor={id}>
      <input id={id} type="checkbox" className="dd-toggle" checked={value} onChange={(e) => onCommit(e.target.checked)} />
    </FieldRow>
  )
}

export function SelectField({ label, value, options, onCommit }: { label: string; value: string; options: { value: string; label: string }[]; onCommit: (v: string) => void }) {
  const id = useId()
  return (
    <FieldRow label={label} htmlFor={id}>
      <select id={id} className="dd-input" value={value} onChange={(e) => onCommit(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  )
}

export function SegmentedField({ label, value, options, onCommit }: { label: string; value: string; options: { value: string; label: string }[]; onCommit: (v: string) => void }) {
  // Not a <label> (a group of buttons has no single labelable control); use a plain
  // row with the group's aria-label as the sole accessible name.
  return (
    <div className="dd-field">
      <span className="dd-field-label" aria-hidden="true">{label}</span>
      <span className="dd-field-control">
        <span className="dd-segmented" role="group" aria-label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className="dd-segment"
              aria-pressed={value === o.value}
              onClick={() => onCommit(o.value)}
            >
              {o.label}
            </button>
          ))}
        </span>
      </span>
    </div>
  )
}

export function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const id = useId()
  return (
    <FieldRow label={label} htmlFor={id}>
      <input id={id} type="color" className="dd-color-input" value={value || '#000000'} onChange={(e) => onCommit(e.target.value)} />
    </FieldRow>
  )
}

export function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="dd-insp-section" aria-label={title}>
      <h3 className="dd-insp-heading">{title}</h3>
      <div className="dd-insp-body">{children}</div>
    </section>
  )
}
