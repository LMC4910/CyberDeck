// The 13 EVCAT platform events (CD-120), typed against the generated contract
// payloads. A TypedEventBus gives compile-time-checked emit/on for these names
// while delegating to the untyped EventBus.
import type {
  AICompletedEvent,
  AIStartedEvent,
  ExtensionInstalledEvent,
  FileOpenedEvent,
  FlowExecutedEvent,
  NotificationReceivedEvent,
  ProjectOpenedEvent,
  SettingsChangedEvent,
  ThemeChangedEvent,
  VariableChangedEvent,
  WidgetClosedEvent,
  WidgetLoadedEvent,
  WorkspaceChangedEvent,
} from '@/shared/contract'
import { EventBus, type Handler } from './event-bus'

/** The 13 EVCAT events → their payload types. */
export interface EventMap {
  ProjectOpened: ProjectOpenedEvent
  FileOpened: FileOpenedEvent
  WidgetLoaded: WidgetLoadedEvent
  WidgetClosed: WidgetClosedEvent
  ThemeChanged: ThemeChangedEvent
  WorkspaceChanged: WorkspaceChangedEvent
  VariableChanged: VariableChangedEvent
  FlowExecuted: FlowExecutedEvent
  AIStarted: AIStartedEvent
  AICompleted: AICompletedEvent
  NotificationReceived: NotificationReceivedEvent
  ExtensionInstalled: ExtensionInstalledEvent
  SettingsChanged: SettingsChangedEvent
}

export type EventName = keyof EventMap

/** The 13 catalog event names (runtime list, e.g. for the inspector). */
export const EVENT_NAMES: readonly EventName[] = [
  'ProjectOpened',
  'FileOpened',
  'WidgetLoaded',
  'WidgetClosed',
  'ThemeChanged',
  'WorkspaceChanged',
  'VariableChanged',
  'FlowExecuted',
  'AIStarted',
  'AICompleted',
  'NotificationReceived',
  'ExtensionInstalled',
  'SettingsChanged',
]

/** Typed facade over EventBus for the catalog events. */
export class TypedEventBus {
  private readonly bus: EventBus
  constructor(bus: EventBus) {
    this.bus = bus
  }

  emit<K extends EventName>(name: K, payload: EventMap[K]): void {
    this.bus.emit(name, payload)
  }

  on<K extends EventName>(name: K, handler: (payload: EventMap[K]) => void): () => void {
    return this.bus.subscribe(name, handler as Handler)
  }

  /** Escape hatch to the underlying bus for wildcard/dev use. */
  get raw(): EventBus {
    return this.bus
  }
}
