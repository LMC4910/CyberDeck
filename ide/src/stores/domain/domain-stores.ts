// Remaining domain stores (CD-132) — the 9 that complete the design's 13 STORES
// (the boot-critical 4 are in ../boot-critical). Shapes lean on generated doc
// types where they apply. Runtime is a capped ring buffer; Notification is a
// derived projection of NotificationReceived events.
import type {
  CyberDeckProjectDocumentCyberdeckProject as ProjectDocument,
  NotificationReceivedEvent,
  RuntimeLogEvent,
} from '@/shared/contract'
import { createStore, type Store } from '../store-base'

// --- Project (persisted · cdk-project · after-shell) ---
export type ProjectState = { doc: ProjectDocument | null }
export function createProjectStore(): Store<ProjectState> {
  return createStore<ProjectState>(
    { doc: null },
    { name: 'project', kind: 'persisted', location: 'cdk-project', restoreAt: 'after-shell' },
  )
}

// --- Widget (derived · memory · lazy) — instance state derived from manifests + project ---
export type WidgetState = { instances: Record<string, unknown> }
export function createWidgetStore(): Store<WidgetState> {
  return createStore<WidgetState>({ instances: {} }, { name: 'widget', kind: 'derived' })
}

// --- Editor (persisted · cdk-editor · boot) — camera + selection ---
export type EditorState = { zoom: number; selection: string[] }
export function createEditorStore(): Store<EditorState> {
  return createStore<EditorState>(
    { zoom: 1, selection: [] },
    { name: 'editor', kind: 'persisted', location: 'cdk-editor', restoreAt: 'boot' },
  )
}

// --- Binding (persisted · cdk-bindings · after-shell) — binds/states/events ---
export type BindingState = {
  bindings: Record<string, unknown>
  states: Record<string, unknown>
  events: Record<string, unknown>
}
export function createBindingStore(): Store<BindingState> {
  return createStore(
    { bindings: {}, states: {}, events: {} },
    { name: 'binding', kind: 'persisted', location: 'cdk-bindings', restoreAt: 'after-shell' },
  )
}

// --- History (temp · memory) — undo stack is NOT persisted ---
export type HistoryState = { index: number; depth: number }
export function createHistoryStore(): Store<HistoryState> {
  return createStore({ index: 0, depth: 0 }, { name: 'history', kind: 'temp' })
}

// --- Repository Cache (cached · memory) ---
export type RepositoryCacheState = { hits: number; misses: number }
export function createRepositoryCacheStore(): Store<RepositoryCacheState> {
  return createStore({ hits: 0, misses: 0 }, { name: 'repositoryCache', kind: 'cached' })
}

// --- AI (server · lazy) — conversations survive restart server-side ---
export type AIState = { threads: unknown[] }
export function createAIStore(): Store<AIState> {
  return createStore<AIState>({ threads: [] }, { name: 'ai', kind: 'server', restoreAt: 'lazy' })
}

// --- Runtime (temp · capped ring buffer) ---
export type RuntimeState = { entries: RuntimeLogEvent[] }
export const RUNTIME_CAP = 500
export function createRuntimeStore(): Store<RuntimeState> {
  return createStore<RuntimeState>({ entries: [] }, { name: 'runtime', kind: 'temp' })
}
/** Append a log entry, keeping at most `cap` (drop oldest). */
export function appendRuntime(store: Store<RuntimeState>, entry: RuntimeLogEvent, cap = RUNTIME_CAP): void {
  store.setState((s) => {
    const entries = [...s.entries, entry]
    if (entries.length > cap) entries.splice(0, entries.length - cap)
    return { entries }
  })
}

// --- Notification (derived · memory) — projection of NotificationReceived events ---
export type NotificationState = { items: NotificationReceivedEvent[] }
export function createNotificationStore(): Store<NotificationState> {
  return createStore<NotificationState>({ items: [] }, { name: 'notification', kind: 'derived' })
}
/** Project a NotificationReceived event into the store (newest first). */
export function projectNotification(
  store: Store<NotificationState>,
  event: NotificationReceivedEvent,
): void {
  store.setState((s) => ({ items: [event, ...s.items] }))
}
