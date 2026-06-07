# CyberDeck — Phase 2 (Media Integration) Deep Dive

**Document 4 of the CyberDeck Enterprise Documentation Set · Per-Phase Deep Dive**
Version 0.1 (Draft) · June 2026 · Codebase ID: `com.shishir.cyberdeck`

> Implementation-depth specification for **Phase 2 (Media Integration)**. Builds entirely on the Phase 1 foundation and its seams. Authority chain unchanged (Doc 0 → 1 → 2/2A–2G/2-ADR → this). New architectural decision introduced here: **ADR-0021 (binary asset delivery)**.

## Contents
1. Phase intent & definition of done
2. Scope: in / out
3. What this phase consumes from Phase 1 (the seams)
4. Workstream map & dependency order
5. WS-2.1 Media capability plugin (full metadata + transport controls)
6. WS-2.2 Binary asset delivery (album art) — new seam
7. WS-2.3 Multi-channel volume mixer & audio output
8. WS-2.4 Media widget family
9. WS-2.5 Expanded gesture-slot designer UI
10. WS-2.6 App-focus automatic profile switching
11. WS-2.7 Layout import / export
12. WS-2.8 EQ presets (P3, opportunistic)
13. End-to-end realized journeys
14. Code structure (additions)
15. Test plan
16. Milestones & sequencing
17. Risks & mitigations
18. Acceptance criteria (traced)

---

## 1. Phase intent & definition of done

**Intent.** Turn the Phase-1 "media controls + system volume" stub into a complete media experience — full now-playing metadata, album art on every device (including remote phones), playback position/progress, shuffle/repeat, a multi-channel volume mixer, and a rich media widget family — while delivering two cross-cutting capabilities that media motivates first but the whole product needs: **binary asset delivery** and **automatic app-focus profile switching** (the first consumer of the Phase-1 activation-rule seam). Also completes the **designer UI for the remaining gesture slots** and adds **layout import/export**.

**Definition of done.**
- Now-playing metadata, album art, progress, shuffle/repeat live on all paired device classes, including a remote phone that never shares the host's filesystem.
- Album art transfers once per image (content-addressed cache) and respects the media-state-update latency budget (NFR-04 < 500 ms for metadata; art may arrive slightly later, progressively).
- Multi-channel mixer controls per-app volumes independently of system master.
- The Designer can map all gesture slots (double/down/up/swipe) and edit the media widgets.
- App-focus switching changes a device's active profile automatically per a profile's activation rule, with no client involvement.
- Layout import/export round-trips a profile between engines.
- All Phase-2 ACs (§18) verified; NFR budgets still hold (asset cache must not breach engine RAM budget).

## 2. Scope: in / out

### In scope (Phase 2)
| Area | Included | PRD |
|------|----------|-----|
| Media metadata | track/artist/album, duration, position (≤500 ms), shuffle, repeat | D10-04/05 |
| Album art | retrieval, cache, **binary delivery to remote clients** | D10-03 |
| Volume | multi-channel per-app mixer; audio output device selection | D10-06/07 |
| Media widgets | rich media card, now-playing, progress bar, mixer widget, output selector | D5-09 |
| Designer | UI for double/down/up/swipe slots; media-widget editing | D6-06 |
| Profiles | **automatic app-focus profile switching** (consumes V1 activation rule) | D2 / Doc 0 §12 |
| Portability | layout import/export | D4-11 |
| EQ | EQ presets (P3, opportunistic if time) | D10-08 |

### Out of scope (later)
Gaming optimization/FPS (P3) · smart home (P4) · full notification feed (P5) · plugin SDK (P6) · remote/relay (P7). The **asset delivery** built here is reused by P3 game covers and P5 camera thumbnails (seam, not re-built).

## 3. What this phase consumes from Phase 1 (the seams)

| Phase-1 seam | Phase-2 use |
|--------------|-------------|
| PAL capability interface + provider chains (2G) | `MediaControl` interface gains full metadata/position; new `AudioSessions` + `WindowFocus` capabilities |
| Plugin host + 1P plugin model (2F) | `media` plugin expanded; `windowfocus` provider added; all out-of-process, same contract |
| State store + typed states (2B) | new media/mixer states; album-art state now carries an **asset reference**, not a local path |
| Widget-type registry + renderer registry (2B/2C) | new media widget types registered; client builders added |
| Interaction slot model (2C §3) | designer UI extended to the already-modeled double/down/up/swipe slots |
| Profile activation rule **field + hook** (2B §5.2) | the **consumer** that evaluates the rule and switches profiles is built now |
| Transport channels (2A) | a new **request/response asset fetch** rides the session (ADR-0021) |
| Op-log + document model (2C) | import/export serializes/deserializes a profile document |

No Phase-1 contract changes — every Phase-2 feature attaches at a pre-built seam, validating the foundation design.

## 4. Workstream map & dependency order

```
WS-2.1 Media plugin (metadata/controls) ─┐
WS-2.2 Asset delivery (album art) ────────┼─► WS-2.4 Media widgets ─► WS-2.5 Designer gesture UI
WS-2.3 Volume mixer / output ─────────────┘
WS-2.6 App-focus switching (independent) ─────────────────────────────────────────────
WS-2.7 Import/export (independent) ───────────────────────────────────────────────────
WS-2.8 EQ presets (opportunistic) ────────────────────────────────────────────────────
```
Critical path: WS-2.1 → WS-2.2 → WS-2.4 → WS-2.5. WS-2.3, WS-2.6, WS-2.7 parallelizable. WS-2.8 only if capacity remains.

---

## 5. WS-2.1 — Media capability plugin (full metadata + transport controls)

**Owning TRD:** 2G (`MediaControl`), 2F (plugin). **PRD:** D10-01…05.

### 5.1 Functional flow
```
OS media session changes (track/state/position)
  → media plugin (SMTC/MPNowPlaying/MPRIS provider) fires change handler
  → fetch metadata (title/artist/album/duration); compute position
  → stateUpdate(media.*) via host IPC → StateStore (2B) → delta → clients
  → on track change: emit media.track_changed event (event bus) → triggers album-art fetch (WS-2.2)
User taps play/pause/next/prev/shuffle/repeat
  → interaction event → authorize → invokeAction(media.*) → plugin → OS session command
```

### 5.2 Capability detail
- States (typed): `media.track, media.artist, media.album, media.duration, media.position, media.playing, media.shuffle, media.repeat, media.albumart.ref` (asset ref, see WS-2.2).
- Actions: `media.play/pause/next/previous/shuffle.toggle/repeat.toggle` (no params); position updated ≤500 ms via a polling/event task.
- Provider chain (`MediaControl`): SMTC (Windows) → MPNowPlaying (macOS) → MPRIS (Linux) → unavailable.

### 5.3 Technical spec
- Position: provider task polls playback info on a ≤500 ms cadence; only pushes on change (delta).
- Repeat is tri-state (off/one/all) → enum state; shuffle boolean.
- The plugin owns formatting-free typed values (ADR-0019): `media.position` as seconds (number), client formats `1:24`.

### 5.4 Code structure
```
plugins/media/
  main.go manifest.json
  providers/{smtc_windows.go, mpnowplaying_darwin.go, mpris_linux.go}
  metadata.go position.go controls.go
engine/pal/media.go        // MediaControl interface extended (metadata+position+shuffle/repeat)
```

### 5.5 Data flow
DF-A for media states; new `media.track_changed` event drives WS-2.2. Actions via DF-B.

---

## 6. WS-2.2 — Binary asset delivery (album art) — NEW SEAM (ADR-0021)

**Owning TRD:** 2A (transport addition), 2B (asset ref state). **ADR:** **0021 (new)**.

### 6.1 The problem
Phase 1 represented album art as a local file URL — valid only when client == host. A **remote phone** has no access to the host filesystem, so the art bytes must be transferred. Binary data must not bloat the JSON State channel (base64 per tick would be wasteful and breach budgets).

### 6.2 The decision (ADR-0021)
**Content-addressed asset delivery with client-side cache.**
- The engine computes a **content hash** (e.g. SHA-256) of each asset (album art image) and exposes it as an **asset reference** (`media.albumart.ref = "sha256:abcd…"`), published as an ordinary state (small string).
- When a client needs an asset it doesn't have cached, it issues an **`assetRequest{ref}`** over the session; the engine replies with **`assetResponse{ref, mime, bytes}`** (binary, chunked if large).
- The client caches by hash; identical art (same album replayed, same art across devices) transfers **once per device, ever**.
- This is a **request/response** over the existing session (a typed message pair), not a new always-on channel — keeping ADR-0011's three-channel model intact. Binary payloads are length-framed (2A §5.1) and need no base64.

### 6.3 Capability detail
- Engine-side asset store: the media plugin saves fetched art to the host art cache (carried from old design: `%TEMP%/cyberdeck_art`, TTL 24 h, LRU, ≤100 MB), keyed by content hash; the engine indexes hash→bytes.
- Client-side asset cache: bounded LRU on device; eviction independent of engine.
- Progressive UX: the media card renders metadata immediately and the art when it arrives (a frame or two later) — metadata latency (NFR-04) is unaffected by art transfer.

### 6.4 Technical spec
- New message types (shared envelope, `type:"assetRequest"|"assetResponse"`); large assets chunked with an ordered reassembly.
- Asset bytes are **not** persisted in SQLite (binary, ephemeral) — host cache is the in-memory/temp index; survives restart only via the temp cache (acceptable, art re-fetches cheaply).
- Reused by P3 (game covers, SteamGridDB) and P5 (camera thumbnails) — the asset reference + fetch is capability-agnostic (`asset.ref` shape generalized).

### 6.5 Code structure
```
engine/core/transport/assets.go      // assetRequest/Response handling, chunking
engine/core/assetstore/store.go      // hash index, host cache, LRU/TTL
plugins/media/albumart.go            // fetch art → hash → register in asset store → set ref state
client/lib/net/asset_fetch.dart      // request-on-miss, reassembly
client/lib/cache/asset_cache.dart    // client LRU by hash
```

### 6.6 Data flow
```
track change → plugin fetches art → assetstore.put(bytes) → hash
  → stateUpdate(media.albumart.ref = hash) → clients (DF-A)
client media card sees new ref → cache miss → assetRequest(hash)
  → engine assetResponse(bytes) → client caches → art renders
```

---

## 7. WS-2.3 — Multi-channel volume mixer & audio output

**Owning TRD:** 2G (`AudioSessions`, `AudioOutput`), 2F. **PRD:** D10-06/07.

### 7.1 Capability detail
- Per-app volume: enumerate active audio sessions (app name, current volume, mute); set per-app volume independent of system master (FR-3.5 carried).
- System master volume already exists (Phase 1 `volume` plugin) — mixer extends it.
- Audio output device selection: list output devices; switch default output.

### 7.2 Technical spec
- New PAL capabilities: `AudioSessions` (per-app) and `AudioOutput` (device list/select). Provider chain: Core Audio sessions (Windows/pycaw-equivalent) → CoreAudio (macOS) → PulseAudio/PipeWire (Linux) → unavailable.
- States: `media.volume.system` (exists), `media.volume.<app>` (dynamic per session), `audio.output.current`, `audio.output.list` (enum).
- Actions: `media.volume.set{level}`, `media.volume.app.set{app,level}`, `audio.output.select{device}`.
- Dynamic states: per-app volume states are **created at runtime** as sessions appear/disappear (2B dynamic state creation; designer binds to known ones, with a generic "active app N" fallback).

### 7.3 Code structure
```
plugins/volume/  (expanded)
  sessions_{windows,darwin,linux}.go   output_{windows,darwin,linux}.go
engine/pal/audio.go                    // AudioSessions, AudioOutput interfaces
```

---

## 8. WS-2.4 — Media widget family

**Owning TRD:** 2C §7. **PRD:** D5-09.

### 8.1 Capability detail
New client widget types (registered in widget-type registry, 2B; native builders in client renderer registry, 2C):
- **`media.card`** — album art (asset ref) + track/artist/album + progress bar + transport controls + shuffle/repeat + favourite.
- **`media.nowplaying`** — compact variant (art + title + play/pause) for the persistent media bar.
- **`media.progress`** — standalone progress/scrubber bound to `media.position`/`media.duration`.
- **`media.mixer`** — multi-row per-app volume sliders (binds to `media.volume.*`).
- **`audio.output.selector`** — dropdown bound to `audio.output.list`/`current`.

### 8.2 Technical spec
- `media.card` consumes the asset-ref → asset-fetch path (WS-2.2); renders metadata instantly, art progressively.
- Progress widget updates from `media.position` deltas (≤500 ms) with client-side interpolation between updates for smoothness (no extra traffic).
- Persistent media bar (`media.nowplaying`) appears on non-dashboard pages (carried design intent) — implemented as a page-template element the Designer can include.

### 8.3 Code structure
```
client/lib/render/widgets/{media_card.dart, media_nowplaying.dart, media_progress.dart, media_mixer.dart, audio_output_selector.dart}
shared/schemas/widgets/ (new media widget descriptors)
```

---

## 9. WS-2.5 — Expanded gesture-slot designer UI

**Owning TRD:** 2C §8. **PRD:** D6-06.

### 9.1 Capability detail
The interaction-slot **model** for double-tap/press-down/press-up/swipe already exists from Phase 1 (2C §3); Phase 2 adds the **Designer UI** to map them. The inspector's interaction tab gains slots for `doubleTap, pressDown, pressUp, swipeLeft/Right/Up/Down`, each with the same target picker (action/macro/flow/navigate) and schema-driven param editor as the Phase-1 `tap/longPress/dragValue` slots.

### 9.2 Technical spec
- Pure inspector extension — emits the same `SetInteraction` ops (2C §4.1) for the new slots; no engine change (the slots were always in the widget model). The client gesture capture for these slots already exists from Phase 1 (WS-8); this just exposes authoring.
- pressDown/pressUp are surfaced as a paired "momentary" affordance in the UI (e.g. push-to-talk) to make the down/up semantics clear.

### 9.3 Code structure
```
client/lib/designer/inspector/interaction.dart  (extended: all slots)
```

---

## 10. WS-2.6 — App-focus automatic profile switching

**Owning TRD:** 2B §5.2 (consumer), 2G (`WindowFocus`). **PRD:** D2/Doc 0 §12 seam.

### 10.1 Functional flow
```
foreground app changes on host
  → windowfocus provider emits focus event (app id/exe/title)
  → session manager evaluates each device session's profiles' activationRule
  → if a profile's rule matches (e.g. appFocus match "Cyberpunk2077.exe")
       and that device is set to auto-switch → switch session active profile
  → engine pushes the new profile's layout to that device (DF-C-style) → device shows it
```

### 10.2 Capability detail
- New PAL capability `WindowFocus` (provider chain: Win32 foreground hooks → macOS NSWorkspace → Linux X11/Wayland → unavailable; degrades cleanly where unsupported).
- Consumes the Phase-1 `Profile.activationRule` field and the engine evaluation hook (built but inert in V1).
- Per-device opt-in (`permissions.allowEditTrigger` analog / a device setting `autoSwitch`), so a wall-panel tablet can pin one profile while a gaming phone auto-switches.
- Manual override: a user navigation pins until released (so auto-switch doesn't fight the user).

### 10.3 Technical spec
- Activation rule kinds (V1 reserved → now active): `appFocus{match}`. Future kinds (state-based, time-based) extend the same evaluator.
- Debounced focus events (avoid thrash on rapid alt-tab); last-stable-wins.
- Switching is a session operation (no new document); it just changes which profile the session renders, reusing the layout push path.

### 10.4 Code structure
```
engine/pal/windowfocus.go
plugins/windowfocus/ main.go manifest.json focus_{windows,darwin,linux}.go
engine/core/session/activation.go  (now consumes focus events; was a hook stub in P1)
```

---

## 11. WS-2.7 — Layout import / export

**Owning TRD:** 2C (document model). **PRD:** D4-11.

### 11.1 Capability detail
Export a profile (and its pages/widgets) to a portable file; import it into another engine (or back up). Useful for sharing community layouts (precursor to the P6 marketplace).

### 11.2 Technical spec
- Export serializes the profile document tree (the same `body_json` shape SQLite stores, 2B) + a manifest (device class, required widget types, required actions, schema versions) into a `.cyberdeck-layout` file (a zip with `profile.json` + manifest).
- Import validates: device class compatibility, and that **required widget types/actions exist** in the target engine's registries (a layout depending on a not-installed plugin's action warns and offers to map/skip). This makes the registry-dependency explicit — a layout is portable only as far as its capabilities are present.
- No credentials/secrets in an exported layout (consistent with 2E).

### 11.3 Code structure
```
engine/core/layout/portability.go    // export/import serialization + dependency check
client/lib/designer/import_export.dart
shared/schemas/layout_package.schema.json
```

---

## 12. WS-2.8 — EQ presets (P3 priority, opportunistic)

**PRD:** D10-08 (P3). Included in Phase 2 only if capacity remains, since it's lower priority.

- EQ preset buttons that apply a system/app EQ where the OS/app exposes one; otherwise the capability is `unavailable` (provider chain). States: `media.eq.preset`. Action: `media.eq.set{preset}`. Implemented as a media-plugin extension; deferred without guilt if Phase 2 is tight (it's P3).

---

## 13. End-to-end realized journeys (Phase 2)

**Streamer media session (PRD Persona 2 / Journey extension).** Jordan's iPad shows a `media.card` with live art + progress; taps next/shuffle; adjusts mic vs music via the `media.mixer`; switches audio output to headphones via the selector — all without keyboard shortcuts.

**Album art on a remote-less phone.** A phone (no host FS access) plays a new track → metadata appears instantly → art arrives a frame later via content-addressed fetch → replaying the album shows art instantly (cached).

**Auto-switch on game launch (completes PRD Journey 2).** Launching Cyberpunk brings it to focus → the gaming phone auto-switches to the Gaming profile with no tap; alt-tabbing back to desktop switches back (debounced).

**Share a layout.** A user exports their "Streaming" profile and sends the file to a friend, who imports it; the importer is warned that it needs the (first-party) media actions, which are present, so it loads.

---

## 14. Code structure (additions to the Phase-1 tree)

```
engine/
  core/transport/assets.go
  core/assetstore/store.go
  core/layout/portability.go
  core/session/activation.go        (now active)
  pal/{media.go(extended), audio.go, windowfocus.go}
plugins/
  media/   (expanded: providers, metadata, position, controls, albumart)
  volume/  (expanded: sessions, output)
  windowfocus/  (new)
client/lib/
  net/asset_fetch.dart   cache/asset_cache.dart
  render/widgets/{media_card,media_nowplaying,media_progress,media_mixer,audio_output_selector}.dart
  designer/inspector/interaction.dart (extended)  designer/import_export.dart
shared/schemas/  (media widgets, layout_package)
```

## 15. Test plan

| Layer | Scope | Pass criteria |
|-------|-------|---------------|
| Unit — media plugin | metadata mapping; position cadence; shuffle/repeat enum; provider fallback | correct typed states; unavailable degrades |
| Unit — asset store | hash dedupe; LRU/TTL eviction; chunk reassembly | identical art stored once; bounded size |
| Integration — asset delivery | art reaches a client with no host FS access; cached on second play | one transfer per device per hash; metadata latency unaffected |
| Integration — mixer | per-app volume independent of master; dynamic session states appear/disappear | independent control verified |
| Integration — app-focus | rule match switches profile; debounce; manual override pins | correct profile shown; no thrash |
| Integration — import/export | round-trip a profile; import with missing dependency warns | dependency check correct |
| E2E | streamer journey on iPad emulator; auto-switch on focus | journeys pass |
| Performance | asset cache under RAM budget; media updates ≤500 ms | NFR-04 holds; engine RAM < 150 MB incl. art index |
| Visual regression | media widgets vs design tokens | <2% diff |

## 16. Milestones & sequencing

| Milestone | Content | Gate |
|-----------|---------|------|
| **M2.1 Media metadata live** | WS-2.1 | track/artist/state/position live on a device |
| **M2.2 Art everywhere** | WS-2.2 | album art on a phone with no host FS; cached on replay |
| **M2.3 Mixer & output** | WS-2.3 | per-app volume + output switch |
| **M2.4 Media widgets + designer slots** | WS-2.4 + WS-2.5 | media card authored; all gesture slots mappable |
| **M2.5 Auto-switch** | WS-2.6 | game-launch profile switch, debounced |
| **M2.6 Portability + harden** | WS-2.7 (+WS-2.8 if time) + ACs | import/export round-trips; ACs met |

## 17. Risks & mitigations

| Risk | Prob | Impact | Mitigation |
|------|------|--------|-----------|
| SMTC/MPRIS metadata coverage varies by app | Med | Med | Provider reports partial fields; widgets handle missing fields gracefully |
| Album art latency hurts perceived snappiness | Med | Low | Metadata renders instantly; art progressive; content-addressed cache makes repeats instant |
| Asset cache breaches engine RAM budget | Low | Med | Bounded LRU + TTL on host index; bytes in temp, not RAM-resident long-term |
| Per-app volume API differences (esp. Linux Pulse vs PipeWire) | Med | Med | Provider chain; degrade to system-master-only where unsupported |
| Window-focus detection on Wayland is restricted | Med | Med | Provider chain → unavailable on locked-down Wayland; document; auto-switch simply inert there |
| Chunked binary over the JSON-envelope session | Low | Med | Length-framed binary payloads (2A §5.1); not base64; tested with large art |

## 18. Acceptance criteria (traced)

| AC | Criterion | Trace |
|----|-----------|-------|
| P2-AC-01 | Now-playing metadata (track/artist/album/duration) and play/pause/next/prev work on all paired classes. | D10-01/02, M2.1 |
| P2-AC-02 | Playback position updates ≤500 ms; progress widget interpolates smoothly between updates. | D10-04, NFR-04, M2.1 |
| P2-AC-03 | Shuffle and repeat (tri-state) reflect and toggle correctly. | D10-05, M2.1 |
| P2-AC-04 | Album art displays on a phone with no host filesystem access; identical art transfers once per device (cached). | D10-03, ADR-0021, M2.2 |
| P2-AC-05 | Per-app volume is controllable independently of system master; output device is selectable. | D10-06/07, M2.3 |
| P2-AC-06 | The media card renders metadata immediately and art progressively without breaching media latency. | NFR-04, M2.2/M2.4 |
| P2-AC-07 | The Designer can map all gesture slots (double/down/up/swipe) using the same schema-driven editors. | D6-06, M2.4 |
| P2-AC-08 | Bringing a matching app to focus auto-switches a device's profile (debounced); manual navigation overrides. | Doc 0 §12, M2.5 |
| P2-AC-09 | A profile exports to a portable file and imports into another engine; missing-capability dependencies are detected and warned. | D4-11, M2.6 |
| P2-AC-10 | All Phase-1 NFR budgets still hold with media + asset cache active (RAM <150 MB, 60 FPS, idle CPU <2%). | NFR-08/09, M2.6 |
| P2-AC-11 | Where a media/audio/focus provider is unsupported on an OS, the capability degrades to `unavailable`/`--` with no crash. | ADR-0007, all |

---
*End of Phase 2 Deep Dive (Draft v0.1). New decision ADR-0021 appended to the Decision Log. Next: Phase 3 (Gaming Integration + the visual flow builder UI + schedule triggers).*
