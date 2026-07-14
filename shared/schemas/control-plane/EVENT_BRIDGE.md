# Event bridge map (CD-114)

Maps the engine event-bus topics (`engine/core/eventbus/topics.go`) to the 13 IDE platform events (design `EVCAT()`). Each IDE event has a payload schema in `events/`. The EngineGateway (M5) subscribes to engine topics and re-emits the mapped IDE event onto the IDE EventBus (CD-120); MockApiGateway synthesizes the same IDE events from fixture activity, so subscribers are identical on both gateways.

## Bridge table

| IDE event (`EVCAT`) | subs | engine topic(s) | payload schema (`events/`) | Notes |
|---|---:|---|---|---|
| `VariableChanged` | 23 | `state.changed`, `threshold.crossed` | `variable-changed` | highest fan-out; drives most widgets |
| `FlowExecuted` | 6 | `flow.run`, `flow.failed` | `flow-executed` | `status` = ok/failed from which topic fired |
| `ProjectOpened` | 7 | `session.opened` | `project-opened` | engine session ↔ IDE project open |
| `NotificationReceived` | 2 | *(plugin-raised; no single topic)* | `notification-received` | plugins raise via the notifications channel |
| `ExtensionInstalled` | 8 | `plugin.started` | `extension-installed` | also observes `plugin.crashed`/`plugin.stopped` for status |
| `ThemeChanged` | 12 | — | `theme-changed` | IDE-internal only |
| `WorkspaceChanged` | 9 | — | `workspace-changed` | IDE-internal only |
| `SettingsChanged` | 15 | — | `settings-changed` | shape = CD-109 delta |
| `FileOpened` | 3 | — | `file-opened` | IDE-internal only |
| `WidgetLoaded` | 4 | — | `widget-loaded` | IDE-internal (widget registry lifecycle) |
| `WidgetClosed` | 3 | — | `widget-closed` | IDE-internal only |
| `AIStarted` | 4 | — | `ai-started` | interface-only (flag `aiProviders`, D7) |
| `AICompleted` | 5 | — | `ai-completed` | interface-only |

## Engine topics with no direct EVCAT event

| engine topic | handled by | Note |
|---|---|---|
| `device.paired` / `device.revoked` | `devices.heartbeat` route (`device-heartbeat` payload) | surfaced through the device stream, not a broadcast IDE event |
| `plugin.stopped` / `plugin.crashed` | folds into `ExtensionInstalled`/status + runtime log | crash → `notification-received` (error) |
| `session.closed` | IDE lifecycle | no IDE event (project close handled locally) |

## Subscription routes → event payloads

The four streaming routes in `routes.v1.json` carry these payloads: `variables.subscribe`→`variable-changed`, `flows.trace`→`flow-executed`, `runtime.log`→`runtime-log`, `devices.heartbeat`→`device-heartbeat`. Each streamed frame is a control-plane envelope (`kind: event`) whose `payload` matches the route's `event` schema.
