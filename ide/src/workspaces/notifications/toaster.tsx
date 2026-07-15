// Toaster (CD-211): renders transient toasts for notifications flagged toast:true.
// An action button (e.g. "Undo", wired to CD-123 undo payloads via onAction) is
// keyboard-operable. Toasts auto-dismiss unless they carry an action.
import { useEffect } from 'react'
import type { Notification } from '@/services/notification'
import './notifications.css'

export interface ToasterProps {
  toasts: Notification[]
  onDismiss: (id: string) => void
  onAction: (notificationId: string, actionId: string) => void
  /** Auto-dismiss delay (ms) for action-less toasts. Default 5000. */
  autoDismissMs?: number
}

export function Toaster({ toasts, onDismiss, onAction, autoDismissMs = 5000 }: ToasterProps) {
  return (
    <div className="toaster" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} onAction={onAction} autoDismissMs={autoDismissMs} />
      ))}
    </div>
  )
}

function Toast({
  toast,
  onDismiss,
  onAction,
  autoDismissMs,
}: {
  toast: Notification
  onDismiss: (id: string) => void
  onAction: (nId: string, aId: string) => void
  autoDismissMs: number
}) {
  useEffect(() => {
    if (toast.actions.length) return // actionable toasts stay until acted/dismissed
    const h = setTimeout(() => onDismiss(toast.id), autoDismissMs)
    return () => clearTimeout(h)
  }, [toast.id, toast.actions.length, onDismiss, autoDismissMs])

  return (
    <div role="status" data-toast={toast.id} data-level={toast.level} className={`toast toast-${toast.level}`}>
      <div className="toast-body">
        <strong className="toast-title">{toast.title}</strong>
        {toast.body && <span className="toast-text">{toast.body}</span>}
      </div>
      <div className="toast-actions">
        {toast.actions.map((a) => (
          <button
            key={a.id}
            data-toast-action={a.id}
            className="toast-action"
            onClick={() => {
              onAction(toast.id, a.id)
              onDismiss(toast.id)
            }}
          >
            {a.label}
          </button>
        ))}
        <button
          aria-label="Dismiss notification"
          data-toast-dismiss={toast.id}
          className="toast-dismiss"
          onClick={() => onDismiss(toast.id)}
        >
          ×
        </button>
      </div>
    </div>
  )
}
