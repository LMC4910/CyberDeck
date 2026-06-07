# CyberDeck — Phase 5 (Notifications & Security Cameras) Deep Dive

**Document 7 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 5**. Completes the unified notification pipeline (Phase 1 shipped only a count badge) and adds security-camera previews. Camera previews extend the Phase-2 asset pipeline (ADR-0021) into **periodic/streamed** frames. New decision: **ADR-0026 (streamed/periodic asset frames vs static assets)**.

## Contents
1. Phase intent & definition of done
2. Scope: in / out
3. Seams consumed
4. Workstream map
5. WS-5.1 Notification aggregation pipeline
6. WS-5.2 Notification model, priority & filtering
7. WS-5.3 Notification actions & widgets
8. WS-5.4 Camera previews (streamed asset frames)
9. WS-5.5 Notifications & cameras in flows
10. End-to-end realized journeys
11. Code structure (additions)
12. Test plan
13. Milestones & sequencing
14. Risks & mitigations
15. Acceptance criteria (traced)

---

## 1. Phase intent & definition of done

**Intent.** Turn the Phase-1 notification *count badge* into a full **aggregation, triage, and action** experience across sources (Windows action center, Discord, Streamlabs, Spotify, system, smart-home), and add **security-camera preview tiles** by extending the asset pipeline to handle periodically-refreshed frames.

**Definition of done.**
- Notifications from multiple sources aggregate into one feed with source, title, body, timestamp, and priority.
- Filtering (All/System/Apps/Alerts/Messages), dismiss, mark-all-read, and open-source-app all work.
- Camera tiles show periodically-refreshed thumbnails (reusing/extending the asset pipeline), with a clear live/last-updated indicator and graceful unavailability.
- Notification events feed the flow engine (e.g. "on Streamlabs donation → flash a light").
- All Phase-5 ACs verified; no exfiltration; budgets hold (camera frames must not blow RAM/bandwidth).

## 2. Scope: in / out

### In scope (Phase 5)
| Area | Included | PRD |
|------|----------|-----|
| Aggregation | Windows action center, Discord, Streamlabs, Spotify, system, smart-home | D13-02/03 |
| Model | source/title/body/timestamp/priority; 50-item ring buffer (carried) | D13-03/05 |
| Triage | filter tabs; dismiss; mark-all-read; open-source-app | D13-03/04/06 |
| Widgets | notification feed/panel, filter tabs, priority badges, count badge (exists) | D13-* |
| Cameras | preview tiles (periodic thumbnails); live/last-updated indicator | D12-09 |
| Automation | notification & camera-motion events as flow triggers | D7 × D13 |

### Out of scope
Full real-time video streaming (only periodic thumbnails in V-scope; live RTSP/HLS playback is a later enhancement) · plugin SDK (P6) · remote (P7).

## 3. Seams consumed

| Seam | Phase-5 use |
|------|-------------|
| Plugin contract (2F) | `notifications` plugin expanded; camera frames via the smart-home plugin (HA `camera_proxy`) |
| `Notifications` PAL capability (2G) | OS action-center listener (P1) extended; multi-source aggregation |
| Asset delivery (ADR-0021) | camera thumbnails reuse content-addressed fetch — extended to **periodic frames** (ADR-0026) |
| Event bus + flow triggers (2B/2D) | notification.received / camera.motion events trigger flows |
| External-integration pattern (ADR-0025) | Streamlabs (WebSocket) + Discord/HA sources follow the same connection lifecycle |
| Ring buffer (in-memory, 2B) | the 50-item notification buffer is in-memory, not persisted (carried) |

## 4. Workstream map

```
WS-5.1 Aggregation ─► WS-5.2 Model/priority/filter ─► WS-5.3 Actions & widgets
WS-5.4 Camera previews (independent; extends ADR-0021) ────────────────────────
WS-5.5 Notifications/cameras in flows (after 5.2 / 5.4) ───────────────────────
```

---

## 5. WS-5.1 — Notification aggregation pipeline

**Owning TRD:** 2G (`Notifications`), 2F, ADR-0025 (for networked sources). **PRD:** D13-02.

### 5.1 Functional flow
```
Source emits a notification:
  Windows action center (WinRT listener) / Discord (WinRT) / Streamlabs (WS) /
  Spotify (SMTC track change) / system / smart-home (HA event)
  → notifications plugin normalizes into a NotificationItem
  → append to 50-item in-memory ring buffer (oldest discarded)
  → notification.count++ ; notification.latest.* states updated
  → notification.received event → event bus (flow triggers, WS-5.5)
  → feed states → clients (DF-A)
```

### 5.2 Capability detail
- **Sources** (each a provider within the notifications plugin, following ADR-0025 where networked): Windows action center & Discord via WinRT listener; Streamlabs via WebSocket; Spotify via SMTC track-change; system; smart-home via HA events.
- **NotificationItem**: `{ id, source, title, body, timestamp, priority }`. Per-source priority mapping carried from the old design (Discord DM=High, mention=Med, server=Low; system security=High; Streamlabs donation=High; etc.).
- **No credential storage for Discord** (carried SR-003): reads OS action-center notifications only — does not store Discord tokens.

### 5.3 Technical spec
- The ring buffer is **in-memory** (2B; not persisted — carried). `notification.latest.*` are normal states; the full buffer is exposed to the feed widget via a buffer-snapshot request (a small request/response, like assets but text).
- Networked sources (Streamlabs WS) use the ADR-0025 connection lifecycle (connected/degraded/error, reconnect).

### 5.4 Code structure
```
plugins/notifications/ (expanded)
  main.go manifest.json
  sources/{winrt_actioncenter.go, discord_winrt.go, streamlabs_ws.go, spotify_smtc.go, system.go, smarthome.go}
  model.go ringbuffer.go priority.go aggregate.go
```

---

## 6. WS-5.2 — Notification model, priority & filtering

**PRD:** D13-03/05.

- **Categories** for filtering: All / System / Apps / Alerts / Messages — each source maps to a category; the filter is a client-side view over the buffer plus an engine-side `notification.filter.set` action that sets the active filter state.
- **Priority badges** (D13-05, P2): high/medium/low, colour + icon (never colour alone — accessibility, Doc 0 §9).
- Unread tracking: per-item read flag; `notification.count` reflects unread across sources.

---

## 7. WS-5.3 — Notification actions & widgets

**PRD:** D13-03/04/06.

### 7.1 Actions
- `notification.dismiss{id}`, `notification.markallread`, `notification.filter.set{source|category|all}`, `notification.open.app{app}` (open the source app; toast if not found).

### 7.2 Widgets
- **notification feed/panel** — scrollable cards (source icon, app, timestamp, 2-line body, unread dot colour-coded by priority); tap → open source app; swipe/long-press → dismiss.
- **filter tabs** widget; **priority badge**; the **count badge** already exists (P1) and now reflects the aggregated unread count.
- Slide-over panel access from any page via a bell icon (carried design).

```
client/lib/render/widgets/{notification_feed, notification_filter_tabs, notification_card, priority_badge}.dart
```

---

## 8. WS-5.4 — Camera previews (streamed/periodic asset frames)

**Owning TRD:** ADR-0021 (extended), ADR-0025 (HA source). **PRD:** D12-09. **ADR:** **0026 (new)**.

### 8.1 The problem
Album art (Phase 2) is a **static** asset — fetched once, cached forever by hash. A camera preview is a **changing** image — a fresh frame every few seconds. Content-addressed caching still applies per-frame (each frame has its own hash), but we need a mechanism for **periodic refresh** without flooding the session or treating each frame as a brand-new permanent cache entry.

### 8.2 The decision (ADR-0026)
**Periodic asset frames as a refresh policy layered on ADR-0021.**
- A camera tile binds to a **frame-producing asset source** with a **refresh interval** (e.g. every 2–5 s, configurable, default conservative).
- Each refresh: the engine (via the HA `camera_proxy` provider) fetches a JPEG frame → hashes it → updates the tile's `frame.ref` state. The client fetches the new frame via the existing `assetRequest` path (ADR-0021).
- **Frame cache is short-TTL and tile-bounded** (unlike album art's long-lived cache) — old frames evict immediately; only the latest 1–2 frames per tile are retained. This keeps it from polluting the static-asset cache or growing unbounded.
- Refresh runs **only while a camera tile is on a visible page of a connected session** (no fetching for off-screen cameras) — a subscription-driven optimization, mirroring state subscription filtering (2A).
- A **live/last-updated indicator** shows freshness; on fetch failure/timeout the tile shows the last frame dimmed + an offline badge (degradation contract).

### 8.3 Capability detail
- Camera entities discovered via HA (Phase 4 mapping); `home.camera.*` exposes a frame source.
- `home.camera.view{entity}` action (carried from 2A TRD): opens the full stream URL in the system browser if available (full in-app video playback is out of scope — periodic thumbnails only).
- Real video (RTSP/HLS) playback is explicitly **deferred** — Phase 5 delivers preview tiles, not a video player.

### 8.4 Technical spec
- The periodic-frame fetcher is a smart-home/notifications-plugin task gated by visibility subscription; respects the 3 s timeout → offline (ADR-0025).
- Bandwidth-aware: configurable interval; the engine never pushes frames unsolicited — the client pulls the latest `frame.ref` on its refresh cadence (consistent with ADR-0021 request/response).

### 8.5 Code structure
```
plugins/smarthome/ camera.go            // camera_proxy frame fetch → hash → frame.ref state
engine/core/assetstore/frames.go        // short-TTL, tile-bounded frame cache (vs static asset cache)
engine/core/transport/assets.go         // (reused) assetRequest/Response carries frames too
client/lib/render/widgets/camera_tile.dart   // periodic refresh, live/last-updated indicator
```

---

## 9. WS-5.5 — Notifications & cameras in flows

**PRD:** D7 × D13.

- **Notification events** (`notification.received` with source/priority) feed `event`/`stateChange` flow triggers — e.g. "on Streamlabs donation (High) → flash the office light + play a sound."
- **Camera motion** (HA motion event) → `device.*`/event trigger → e.g. "on front-door motion → switch the wall tablet to the camera profile" (the camera profile shows the tile; full view in browser via the action).
- No flow-engine change — these are registry events/actions consumed by the existing trigger model (the registry-driven design paying off yet again).

---

## 10. End-to-end realized journeys (Phase 5)

**Notification triage (PRD Journey 3, now full).** Badge shows 6 unread → user opens the slide-over feed → filters to Alerts → dismisses non-critical → taps a Discord message to open Discord. (Phase 1 had only the badge; this completes it.)

**Streamer donation reaction.** Jordan's "donation" flow flashes a light and plays a sound when a Streamlabs donation arrives — notification event → flow.

**Home monitoring.** Riley's wall tablet shows four camera tiles refreshing every few seconds with a last-updated indicator; on front-door motion, a flow switches the tablet to the camera profile; tapping a tile opens the full stream in the browser.

## 11. Code structure (additions)

```
plugins/notifications/ (expanded: sources/, model, ringbuffer, priority, aggregate)
plugins/smarthome/ camera.go
engine/core/assetstore/frames.go
client/lib/render/widgets/{notification_feed, notification_filter_tabs, notification_card, priority_badge, camera_tile}.dart
shared/schemas/widgets/ (notification + camera widgets)
```

## 12. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — aggregation | source normalization; priority mapping; ring-buffer eviction (50) | correct items/priority; oldest discarded |
| Unit — frame cache | per-frame hash; short-TTL tile-bounded eviction; latest-only | no unbounded growth; static cache unaffected |
| Integration — sources | each source emits → feed updates; Streamlabs WS reconnect | all sources aggregate; networked sources degrade per ADR-0025 |
| Integration — triage | filter/dismiss/mark-all-read/open-app | correct feed + count behavior |
| Integration — cameras | periodic refresh only when visible+connected; offline → dimmed last frame | visibility-gated; graceful offline |
| Integration — flows | notification/motion event triggers a flow | cross-domain reactions work |
| Performance | 4 cameras @ refresh + multi-source notifications | budgets hold; no off-screen fetching |
| Security | no Discord token stored; no exfiltration; frames stay on LAN | controls hold |

## 13. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M5.1 Aggregation** | WS-5.1 + WS-5.2 | multi-source feed + priority + filter |
| **M5.2 Triage** | WS-5.3 | dismiss/mark-all/open-app; feed widget |
| **M5.3 Cameras** | WS-5.4 | periodic preview tiles, visibility-gated, offline-graceful |
| **M5.4 Automation + harden** | WS-5.5 + ACs | notification/motion flows; budgets/security verified |

## 14. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| OS notification-access permissions blocked | Med | Med | Provider degrades to unavailable; document the OS permission steps |
| Camera frames blow bandwidth/RAM | Med | Med | Visibility-gated pull; short-TTL tile-bounded frame cache (ADR-0026); configurable interval |
| Streamlabs/Discord API/listener drift | Med | Low | ADR-0025 lifecycle + per-source isolation; degrade per source |
| Users expect live video, get thumbnails | Med | Low | Clear "preview"/last-updated labeling; full stream opens in browser; live playback flagged as later |
| Notification flooding | Low | Low | 50-item ring buffer; coalescing; priority surfacing |

## 15. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P5-AC-01 | Notifications from multiple sources aggregate into one feed with source/title/body/timestamp/priority. | D13-02/03, M5.1 |
| P5-AC-02 | Filter tabs, dismiss, mark-all-read, and open-source-app all work; the count badge reflects aggregated unread. | D13-03/04/06, M5.2 |
| P5-AC-03 | Priority badges use colour **and** icon/text (never colour alone). | Doc 0 §9, M5.1 |
| P5-AC-04 | Camera tiles refresh periodically only while visible on a connected session; off-screen cameras are not fetched. | D12-09, ADR-0026, M5.3 |
| P5-AC-05 | A camera tile shows a live/last-updated indicator and degrades to a dimmed last frame + offline badge on failure. | ADR-0026/0007, M5.3 |
| P5-AC-06 | Per-frame caching does not pollute or unbound the static-asset cache. | ADR-0026, M5.3 |
| P5-AC-07 | Notification and camera-motion events trigger flows with no flow-engine change. | D7×D13, M5.4 |
| P5-AC-08 | No Discord token is stored; no notification or frame data is exfiltrated; frames stay on LAN. | SR-003 carried, M5.4 |
| P5-AC-09 | NFR budgets hold with 4 cameras + multi-source notifications active. | NFR-08/09, M5.4 |

---
*End of Phase 5 Deep Dive (Draft v0.1). New decision ADR-0026 appended to the Decision Log. Next: Phase 6 (Plugin SDK & Ecosystem).*
