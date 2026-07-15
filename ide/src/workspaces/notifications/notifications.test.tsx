import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { renderWithProviders } from '@/shared/test'
import { createStore } from '@/stores'
import type { Notification } from '@/services/notification'
import { Toaster, NotificationDrawer } from '@/workspaces'

const notificationStore = () =>
  createStore<{ items: Notification[] }>({ items: [] }, { name: 'notification', kind: 'derived' })
const project = (store: ReturnType<typeof notificationStore>, n: Notification) =>
  store.setState((s) => ({ items: [n, ...s.items] }))

const ntf = (over: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  level: 'info',
  source: 'system',
  title: 'Hello',
  actions: [],
  ts: 0,
  read: false,
  toast: true,
  ...over,
})

describe('Toaster — undo action', () => {
  it('an undo toast triggers undo via onAction, then dismisses', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    const toast = ntf({ id: 't1', title: 'Moved widget', actions: [{ id: 'undo', label: 'Undo' }] })
    const { container } = renderWithProviders(
      <Toaster toasts={[toast]} onDismiss={onDismiss} onAction={onAction} />,
    )
    act(() => (container.querySelector('[data-toast-action="undo"]') as HTMLElement).click())
    expect(onAction).toHaveBeenCalledWith('t1', 'undo')
    expect(onDismiss).toHaveBeenCalledWith('t1')
  })

  it('an action-less toast auto-dismisses after the delay', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    renderWithProviders(
      <Toaster toasts={[ntf({ id: 't2', actions: [] })]} onDismiss={onDismiss} onAction={() => {}} autoDismissMs={1000} />,
    )
    act(() => vi.advanceTimersByTime(1000))
    expect(onDismiss).toHaveBeenCalledWith('t2')
    vi.useRealTimers()
  })
})

describe('NotificationDrawer — store projection + mark-all-read', () => {
  it('projects the Notification store and marks all read', () => {
    const store = notificationStore()
    project(store, ntf({ id: 'a', title: 'First' }))
    project(store, ntf({ id: 'b', title: 'Second' }))

    const onMarkAllRead = () =>
      store.setState((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) }))

    const { container, getByText } = renderWithProviders(
      <NotificationDrawer store={store} open onClose={() => {}} onMarkAllRead={onMarkAllRead} />,
    )
    // newest first, both listed
    expect(container.querySelectorAll('[data-ntf-item]')).toHaveLength(2)
    expect(getByText('Notifications (2)')).toBeInTheDocument()

    act(() => (container.querySelector('[data-ntf-mark-all]') as HTMLElement).click())
    // all read → count gone + items flagged read
    expect(container.querySelectorAll('[data-read="true"]')).toHaveLength(2)
    expect(container.querySelector('[data-ntf-mark-all]')).toBeDisabled()
  })

  it('Escape closes the drawer (keyboard operable)', () => {
    const store = notificationStore()
    const onClose = vi.fn()
    const { getByRole } = renderWithProviders(
      <NotificationDrawer store={store} open onClose={onClose} onMarkAllRead={() => {}} />,
    )
    act(() => getByRole('dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalled()
  })
})
