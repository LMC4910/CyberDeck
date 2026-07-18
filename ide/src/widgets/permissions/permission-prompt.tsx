// Permission prompt modal (CD-422). Renders the head of the controller's queue and
// resolves the broker's promise on the user's choice. Shown on first use of a gated
// capability. Renders nothing when idle.
import { useSyncExternalStore } from 'react'
import type { PermissionPromptController } from './prompt-controller'
import './permissions.css'

export interface WidgetPermissionPromptProps {
  controller: PermissionPromptController
}

export function WidgetPermissionPrompt({ controller }: WidgetPermissionPromptProps) {
  const request = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.current(),
  )
  if (!request) return null

  return (
    <div className="wperm-prompt-backdrop" role="dialog" aria-modal="true" data-perm-prompt>
      <div className="wperm-prompt">
        <h3 className="wperm-prompt__title">Permission request</h3>
        <p className="wperm-prompt__body">
          <strong>{request.widgetId}</strong> wants to use the{' '}
          <code>{request.capability}</code> capability.
          {request.reason ? <span className="wperm-prompt__reason"> {request.reason}</span> : null}
        </p>
        <div className="wperm-prompt__actions">
          <button
            type="button"
            className="wperm-btn wperm-btn--deny"
            onClick={() => controller.decide('denied')}
          >
            Deny
          </button>
          <button
            type="button"
            className="wperm-btn wperm-btn--grant"
            onClick={() => controller.decide('granted')}
          >
            Grant
          </button>
        </div>
      </div>
    </div>
  )
}
