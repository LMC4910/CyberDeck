// Notification drawer (CD-211): a projection of the Notification store. Lists all
// received notifications (newest first), supports mark-all-read, keyboard operable.
import type { Store } from '@/stores'
import { useStore } from '@/stores'
import type { Notification } from '@/services/notification'
import './notifications.css'

interface NotificationState {
  items: Notification[]
}

export interface NotificationDrawerProps {
  store: Store<NotificationState>
  open: boolean
  onClose: () => void
  onMarkAllRead: () => void
}

export function NotificationDrawer({ store, open, onClose, onMarkAllRead }: NotificationDrawerProps) {
  const items = useStore(store, (s) => s.items)
  if (!open) return null
  const unread = items.filter((n) => !n.read).length

  return (
    <aside
      className="ntf-drawer"
      role="dialog"
      aria-label="Notifications"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <header className="ntf-drawer-head">
        <span>Notifications{unread > 0 ? ` (${unread})` : ''}</span>
        <div>
          <button data-ntf-mark-all onClick={onMarkAllRead} disabled={unread === 0}>
            Mark all read
          </button>
          <button aria-label="Close notifications" data-ntf-close onClick={onClose}>
            ×
          </button>
        </div>
      </header>
      <ul className="ntf-list" aria-label="Notification list">
        {items.length === 0 && <li className="ntf-empty">No notifications</li>}
        {items.map((n) => (
          <li
            key={n.id}
            data-ntf-item={n.id}
            data-read={n.read}
            className={n.read ? 'ntf-item read' : 'ntf-item'}
          >
            <span className="ntf-source" data-level={n.level}>
              {n.source}
            </span>
            <span className="ntf-title">{n.title}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
