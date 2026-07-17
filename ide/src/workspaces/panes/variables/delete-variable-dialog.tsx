// Delete confirmation (CD-402). Deleting a variable that widgets or flows still bind
// to breaks them, so the dialog asks the source what references it before offering
// the button — and names them. Multi-select delete funnels through the same dialog.
import { useEffect, useState } from 'react'
import { Dialog } from '@/shared/a11y'
import type { VariableReference, VariablesSource } from './variables-source'

export interface DeleteVariableDialogProps {
  open: boolean
  /** Rows to delete (one, or a multi-selection). */
  ids: string[]
  source: VariablesSource
  onClose: () => void
  onConfirm: () => void
}

export function DeleteVariableDialog({ open, ids, source, onClose, onConfirm }: DeleteVariableDialogProps) {
  const [refs, setRefs] = useState<Record<string, VariableReference[]> | null>(null)

  useEffect(() => {
    if (!open) {
      setRefs(null)
      return
    }
    if (!source.references) {
      // No reference index → say so rather than implying "safe to delete".
      setRefs({})
      return
    }
    let live = true
    void Promise.all(ids.map((id) => source.references!(id).then((r) => [id, r] as const))).then((pairs) => {
      if (live) setRefs(Object.fromEntries(pairs))
    })
    return () => {
      live = false
    }
  }, [open, ids, source])

  if (!open) return null

  const referenced = Object.entries(refs ?? {}).filter(([, list]) => list.length > 0)
  const refCount = referenced.reduce((n, [, list]) => n + list.length, 0)
  const unknownRefs = !source.references

  return (
    <Dialog open={open} onClose={onClose} label="Delete variable">
      <div className="vars-dialog" data-testid="delete-variable-dialog">
        <h2 className="vars-dialog-title">
          Delete {ids.length === 1 ? ids[0]! : `${ids.length} variables`}?
        </h2>

        {refs === null ? (
          <p className="vars-dialog-body">Checking references…</p>
        ) : refCount > 0 ? (
          <div className="vars-dialog-body">
            <p className="vars-warning" data-testid="delete-ref-warning" role="alert">
              ⚠ Still used in {refCount} {refCount === 1 ? 'place' : 'places'}. Deleting will leave{' '}
              {refCount === 1 ? 'it' : 'them'} unbound.
            </p>
            <ul className="vars-ref-list">
              {referenced.flatMap(([id, list]) =>
                list.map((r) => (
                  <li key={`${id}-${r.workspace}-${r.targetId}-${r.via ?? ''}`}>
                    <span className="vars-ref-kind">{r.kind}</span> {r.label}
                    {r.via ? <span className="vars-ref-via"> · {r.via}</span> : null}
                  </li>
                )),
              )}
            </ul>
          </div>
        ) : unknownRefs ? (
          <p className="vars-dialog-body" data-testid="delete-refs-unknown">
            This source cannot report references — check bindings before deleting.
          </p>
        ) : (
          <p className="vars-dialog-body" data-testid="delete-no-refs">
            Nothing references {ids.length === 1 ? 'it' : 'them'}.
          </p>
        )}

        <div className="vars-dialog-actions">
          <button type="button" className="a11y-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="a11y-btn vars-danger"
            data-testid="delete-confirm"
            disabled={refs === null}
            title={refs === null ? 'Checking references…' : undefined}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </Dialog>
  )
}
