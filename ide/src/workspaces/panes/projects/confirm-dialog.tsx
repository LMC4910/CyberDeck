// Confirm dialog (CD-405 delete / CD-406 wizard dirty-guard). Wraps the a11y Dialog
// (focus-trapped, aria-modal, Esc closes) and autofocuses the cancel button, so the
// safe answer is the one Enter lands on for a destructive prompt.
import { useEffect, useRef } from 'react'
import { Dialog } from '@/shared/a11y'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  /** Paints the confirm button as destructive. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  return (
    <Dialog open={open} onClose={onCancel} label={title}>
      <div className="pj-confirm" data-testid="confirm-dialog">
        <h2 className="pj-confirm-title">{title}</h2>
        <p className="pj-confirm-body">{body}</p>
        <div className="pj-confirm-actions">
          <button ref={cancelRef} type="button" className="pj-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'pj-btn pj-btn-danger' : 'pj-btn pj-btn-primary'}
            onClick={onConfirm}
            data-testid="confirm-accept"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
