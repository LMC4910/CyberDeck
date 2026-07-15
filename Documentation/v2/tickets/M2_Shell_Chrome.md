# M2 — Shell & Chrome (CD-201…219)

**Gate:** all seven workspaces navigable (empty panes allowed) · palette executes every registered command · prefs/keyboard/rebinding live · docking + presets + session restore survive relaunch · every visible control operable or honestly disabled · chrome keyboard-complete.
**Entry:** CD-139 passed. **Exit:** CD-219 recorded.

## Board

- [x] CD-201 A11y primitives library — ✅ Done 2026-07-15
- [x] CD-202 WorkspaceService + contribution registry — ✅ Done 2026-07-15
- [x] CD-203 Workspace rail + lazy pane host — ✅ Done 2026-07-15
- [x] CD-204 Per-workspace context preservation + nav history — ✅ Done 2026-07-15
- [x] CD-205 Breadcrumb + status bar — ✅ Done 2026-07-15
- [x] CD-206 Command palette UI — ✅ Done 2026-07-15
- [x] CD-207 Palette recents + groups — ✅ Done 2026-07-15
- [x] CD-208 Preferences shell + general/appearance panes — ✅ Done 2026-07-15
- [x] CD-209 Keyboard pane + rebind UX — ✅ Done 2026-07-15
- [x] CD-210 Settings search — ✅ Done 2026-07-15
- [x] CD-211 NotificationService + toasts + drawer — ✅ Done 2026-07-15
- [x] CD-212 Session restore + relaunch E2E — ✅ Done 2026-07-15
- [x] CD-213 Resizable panels — ✅ Done 2026-07-15
- [x] CD-214 DockManager model — ✅ Done 2026-07-15
- [x] CD-215 Dock UI: zones, insets, auto-hide/peek — ✅ Done 2026-07-16
- [x] CD-216 Declarative dock registration + proof window — ✅ Done 2026-07-16
- [x] CD-217 Layout presets — ✅ Done 2026-07-16
- [ ] CD-218 Honest-stub sweep + placeholder panes
- [ ] CD-219 **M2 gate review**

---

### CD-201 · A11y primitives library
**BP:** IDE-E20-T01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-139
**Do:** Focus-visible ring styles; `Button/Tab/Tree/Dialog` primitives with roles+labels; focus-trap + focus-restore hook; Enter/Space activation helper; reduced-motion hook. Everything below builds on these.
**AC:**
- [x] primitives unit-tested (trap cycles, restore, activation)
- [x] axe clean on a demo page of all primitives

**Notes (2026-07-15):** `ide/src/shared/a11y/` (in `shared` so every layer can use it). `focus.ts`: `getFocusable` (attribute-based hidden checks, **not** offsetParent — jsdom-safe), `useFocusTrap(ref, active)` (cycles Tab/Shift+Tab at both ends, moves focus in, restores on deactivate/unmount), `useFocusRestore`. `activation.ts`: `activateOnKey(run)` fires on Enter/Space + preventDefault. `reduced-motion.ts`: `useReducedMotion` (guards absent matchMedia). `primitives.tsx`: **Button** (aria-label, focus-visible), **Tabs/TabList/Tab/TabPanel** (roving tabindex, aria-selected/controls/labelledby), **Tree/TreeItem** (role tree/treeitem, aria-expanded/selected), **Dialog** (aria-modal, focus-trapped, Esc-to-close, backdrop). `a11y.css`: focus-visible ring (`--accent`), reduced-motion media query. 7 tests: activation Enter/Space + ignore, focus-trap move-in/cycle-both-ends/restore, Tabs roving+panel-swap, and **axe clean on a demo page of all primitives** (0 violations). 281 vitest green.

### CD-202 · WorkspaceService + contribution registry
**BP:** IDE-E07-F01-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-139
**Do:** Workspaces declared as config contributions `{id, icon, order, lazyPane}`; WorkspaceService routes via Workspace store; emits WorkspaceChanged; validates contributions.
**AC:**
- [x] adding a workspace = config entry only (proven by a test workspace)
- [x] unit tests: routing, invalid contribution rejected

**Notes (2026-07-15):** `ide/src/services/workspace/`. `WorkspaceContribution {id, label, icon, order, lazyPane}` where `lazyPane: () => Promise<{default}>` is the dynamic-import loader. `WorkspaceService`: `register`/`registerAll` (validates id pattern `^[a-z][a-z0-9-]*$`, non-empty label/icon, numeric order, function lazyPane → `InvalidWorkspaceError`; dupes → `DuplicateWorkspaceError`), `list()` sorted by order, `active()`/`setActive(id)` (unknown → `UnknownWorkspaceError`; no-op if already active; notifies subscribers + `onChanged`), `subscribe`. **Store-agnostic by design** (services may not import stores): the service owns active-workspace routing state and emits via the injected `onChanged` callback; app-shell wiring mirrors active↔Workspace store and bridges onChanged→WorkspaceChanged on the bus. Test proves **adding a workspace is a config entry only** (a `test-ws` just appears + routes, no other code change). 8 tests: config-entry-only, order sort, invalid/dup rejection, default-active, route+notify+event, unknown-id throw, unsubscribe. 289 vitest green.

### CD-203 · Workspace rail + lazy pane host
**BP:** IDE-E07-F01-T02 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-202, CD-201
**Do:** Left rail (roving tabindex) + pane host mounting each workspace pane via dynamic `import()` on first entry; seven placeholder panes registered.
**AC:**
- [x] each pane is its own chunk (bundle analysis assertion)
- [x] rail keyboard-operable; WorkspaceChanged fires on switch

**Notes (2026-07-15):** `ide/src/workspaces/`. 7 placeholder panes (`panes/*-pane.tsx`) + `WORKSPACE_CONTRIBUTIONS` (home/deck-designer/flows/variables/library/devices/projects, each with `lazyPane: () => import('./panes/…')`). `WorkspaceRail` — vertical tablist with **roving tabindex** (Arrow up/down move focus, Enter/Space + click activate via `activateOnKey`), aria-selected on active. `PaneHost` — `React.lazy` + `Suspense`, WeakMap-cached per loader so re-entry doesn't re-import. **Wired into the real shell**: `boot-sequence.ts` adds a `workspaces` boot phase (registers contributions; `onChanged`→`WorkspaceChanged` on the bus) and `App.tsx` renders rail + pane host, subscribing to route changes. **Each pane is its own chunk — verified against the real build**: `home-pane`, `flows-pane`, … 7 separate `dist/assets/*-pane-*.js` files; `scripts/pane-chunks.test.mjs` (`pnpm test:chunks`, wired into CI after build) asserts it. 5 vitest (7 distinct loaders, roving tabindex, Arrow-nav + click→WorkspaceChanged, lazy mount + switch) + **2 Playwright journeys** (boot shows 7 tabs + Home pane; rail click + keyboard nav lazy-loads Flows/Variables). 294 vitest + 2 E2E green.

### CD-204 · Per-workspace context preservation + nav history
**BP:** IDE-E07-F01-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-203
**Do:** Context snapshot map (scroll/zoom/selection) per workspace; back/forward stack with ⌘[ / ⌘] commands.
**AC:**
- [x] switch→return restores context (test)
- [x] history walk test across ≥3 workspaces

**Notes (2026-07-15):** Extended `WorkspaceService`. **Context preservation**: `saveContext(id, ctx)` / `getContext(id)` — a per-workspace snapshot map (scroll/zoom/selection); switch-away then return reads the saved context back. **Nav history**: `setActive` pushes onto a back/forward stack (truncating the forward tail on a new branch); `back()`/`forward()` move the index and route without re-pushing; `canBack`/`canForward`/`historyStack()`. The `⌘[` (back) / `⌘]` (forward) commands are registered in the `workspaces` boot phase (`boot-sequence.ts`) with handlers calling `workspaces.back/forward`. 14 tests: switch→return restore, per-workspace independence, **history walk across 4 workspaces** (back×2 + forward), edge flags, forward-tail truncation, null-at-ends. 300 vitest green.

### CD-205 · Breadcrumb + status bar
**BP:** IDE-E07-F02 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-203
**Do:** Breadcrumb (`Project › Workspace › Selection`, clickable) and status bar as pure store subscribers; per-workspace segment registry (design mapping); saved-state indicator from ConfigurationService write-behind.
**AC:**
- [x] no imperative sync calls (subscriber pattern only — code review checklist)
- [x] segments swap per workspace; crumb segments navigate

**Notes (2026-07-15):** `ide/src/workspaces/chrome/`. `breadcrumb-segments.ts`: `BREADCRUMB_SEGMENTS` maps each of the 7 workspaces to its `Project › Workspace › Selection` segments (design mapping); `crumbFor(id, ctx)` builds them. `Breadcrumb` renders segments — non-leaf navigable ones are `<button>` calling `onNavigate`, the leaf is `aria-current="page"`. **Pure subscriber**: `StatusBar` reads selection count via `useStore(editorStore, …)` (updates reactively on store mutation, no imperative sync — the AC), plus active workspace + saved-state label. Both **wired into `App.tsx`** (breadcrumb in the top bar, status bar as the footer) — `boot-sequence.ts` now also assembles `createAllStores()` and exposes them on the kernel (also sets up CD-212). Tests: segments swap per workspace, crumb click → onNavigate (leaf not clickable), aria-current on leaf, and **StatusBar reflects Editor-store changes reactively**. 304 vitest + 2 E2E green.

### CD-206 · Command palette UI
**BP:** IDE-E07-F03-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-121, CD-201
**Do:** ⌘K overlay (focus-trapped) rendering context-filtered registry commands; fuzzy scorer; virtualized list; Enter executes / Esc restores focus; shortcut hints from keymap.
**AC:**
- [x] every registered command reachable + executable from the palette (test iterates registry)
- [x] keyboard-complete; axe clean

**Notes (2026-07-15):** `ide/src/workspaces/palette/`. `fuzzy.ts`: `fuzzyScore` (subsequence match + consecutive/word-start bonuses, null on non-match) + `fuzzyFilter` (drop+sort). `CommandPalette`: `Dialog`-based focus-trapped ⌘K overlay; `combobox` input + `listbox`/`option` results with `aria-activedescendant`; **context-filtered** (only `registry.canExecute(id, ctx)` commands); Arrow up/down move highlight, Enter executes, Esc closes (Dialog restores focus); keymap shortcut hints via `shortcutFor`. **Wired into App**: ⌘K/Ctrl+K toggles it (window keydown), executes through `kernel.commands.execute`. Tests: fuzzy ranking, **every context-available command reachable + executable (iterates the registry)**, context filtering hides gated commands, Arrow+Enter keyboard run, Esc close, **axe clean**. E2E: Ctrl+K opens → filter → Enter → closes. Virtualization deferred (BACKLOG — ~26 commands render fine). 311 vitest + 3 E2E green.

### CD-207 · Palette recents + groups ∥
**BP:** IDE-E07-F03-T02 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-206
**Do:** Recent-weighting (persisted), category group headers matching design.
**AC:**
- [x] recents float after use; groups match design ordering

**Notes (2026-07-15):** `PaletteRecents` (`palette-recents.ts`) — persisted MRU list of command ids (StorageAdapter, deduped, capped 8, survives reload). The palette's **empty-query view** now renders grouped: a **"Recently used"** group first (recent commands lifted out of their categories so each appears exactly once — unique DOM ids), then category groups in **design order** (General/Edit/Design/Project/View/Platform). A **non-empty query** drops groups → flat fuzzy-ranked list. Keyboard nav works over the flattened order; `onUse(id)` records recency. Grouped results use `div role="listbox"` > `div role="group"` (aria-labelledby header) > `div role="option"` for valid ARIA containment (the earlier ul/li nesting broke axe). Wired into App with a `LocalStorageAdapter`-backed recents. Tests: MRU record/dedupe/cap/persist, groups in design order, recents float to top group (once each), query drops groups, onUse fires. 316 vitest green.

### CD-208 · Preferences shell + general/appearance panes
**BP:** IDE-E07-F04-T01 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-118, CD-134, CD-201
**Do:** Prefs window (focus-trapped); General + Appearance panes; every control writes through ConfigurationService (no local state); theme picker drives ThemeService.
**AC:**
- [x] round-trip persist test (change → relaunch → value holds)
- [x] zero local component state for settings (review checklist)

**Notes (2026-07-15):** `ide/src/workspaces/preferences/`. `useConfigValue(config, path, fallback)` — `useSyncExternalStore` subscribing to `config.watch(path)`, reading `config.get(path)`: the control renders the LIVE config value with **zero local state** (config is the single source of truth). `PreferencesDialog` — focus-trapped `Dialog` with `Tabs` (General/Appearance). General: telemetry switch + density select, each `config.set(path, val, 'user')`. Appearance: theme radiogroup — selecting `config.set('theme.id')` **and** `theme.apply(id)` for the immediate swap. Wired into App (⌘, keydown + the `prefs` palette command open it). Tests: telemetry toggle writes config + control mirrors (no local state), density writes, **round-trip persist** (toggle → persist user layer via ConfigPersistence → reload through the migration gate into a fresh config → value holds), theme picker writes config + drives ThemeService. (Boot-level config write-behind wiring lands with CD-212 session restore.) 320 vitest green.

### CD-209 · Keyboard pane + rebind UX
**BP:** IDE-E07-F04-T02 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-208, CD-122
**Do:** Keyboard pane rendered from the command registry (single source); rebind flow with conflict warning; reset-to-default.
**AC:**
- [x] rebind persists + takes effect without reload; conflict surfaced

**Notes (2026-07-15):** `ide/src/workspaces/preferences/keyboard-pane.tsx`. `KeyboardPane` renders every command **from the registry** (single source) with its effective binding label (`comboLabel`). **Rebind flow**: click Rebind → capture mode → next keydown → `dispatcher.rebind(id, tokens)`; takes effect immediately (dispatcher resolves the new combo). **Conflict warning**: `dispatcher.conflicts()` → same-combo commands get a `role="alert"` "Conflict" badge + red combo. **Reset-to-default**: `dispatcher.resetBinding(id)` removes the user override. Persistence via `onChange` (caller writes `dispatcher.userBindings()` to the keymap config layer). Added `KeymapDispatcher.resetBinding/bindingFor/userBindings` + `comboLabel`. Surfaced as a **Keyboard tab** in `PreferencesDialog` (shown when commands+dispatcher provided). `boot-sequence.ts` now creates a `KeymapDispatcher` (new `keymap` boot phase, `loadDefaults` after all commands register) on the kernel; App passes it to prefs. Tests: list-from-registry, rebind takes-effect + onChange + UI updates, conflict surfaced on both commands, reset restores default. 324 vitest + 3 E2E + build green.

### CD-210 · Settings search ∥
**BP:** IDE-E07-F04-T03 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-208
**Do:** Search filters panes/rows by label + keywords.
**AC:**
- [x] matches pane content; keyboard navigable results

**Notes (2026-07-15):** `settings-index.ts`: `SETTINGS_INDEX` (each row: id/pane/label/keywords) + `searchSettings(query)` (fuzzy over label+keywords). The `SettingsSearch` searchbox in `PreferencesDialog` shows a `listbox` of matches while querying; Arrow up/down navigate, Enter/click **jumps to the owning pane** (calls onTabChange) and clears. Tests: keyword+label matching (privacy→telemetry, theme, rebind→keyboard), empty/no-match, Enter jumps to pane, Arrow navigation, click jumps. **Refactor**: moved the fuzzy scorer from `workspaces/palette/` to `shared/fuzzy/` — preferences importing it from palette was a cross-feature boundary violation (workspace→workspace); now both palette and preferences import `@/shared/fuzzy`. 328 vitest green.

### CD-211 · NotificationService + toasts + drawer
**BP:** IDE-E07-F05 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-120, CD-130, CD-201
**Do:** `notify({priority, source, actions})` → queue with dedupe + rate-limit; toast renderer (undoable-action affordance wired to CD-123 payloads); drawer as Notification-store projection; toast policy per AUDIT M4 (no ambient-success noise).
**AC:**
- [x] dedupe/rate-limit tests; undo toast triggers undo
- [x] drawer mark-all-read works; keyboard operable

**Notes (2026-07-15):** `ide/src/services/notification/` — `NotificationService.notify(input)` returns the accepted `Notification` or **null** when deduped (same `dedupeKey` within the window) or **rate-limited** (sliding window, default 5/1000ms). **Toast policy (AUDIT M4)**: errors/warnings + anything with an action toast; **ambient success (no action) does NOT toast** — no success noise; explicit `toast` overrides. Store/bus-agnostic (emits via injected `onNotify`; wiring projects to the Notification store + bus). `ide/src/workspaces/notifications/`: `Toaster` renders `toast:true` notifications — action buttons (e.g. **Undo**, wired to CD-123 payloads via `onAction`), action-less toasts auto-dismiss; `NotificationDrawer` is a **Notification-store projection** (`useStore`, newest-first) with **mark-all-read** (disabled at 0 unread) and **Esc-to-close**. Tests: dedupe window, rate-limit slide, policy matrix, emit-with-actions; toaster undo→onAction+dismiss, auto-dismiss timer; drawer projection + mark-all-read + Escape. App wiring (bell button → drawer, service → toaster, undo-stack bridge) lands in the CD-218 honest-stub sweep. 336 vitest green.

### CD-212 · Session restore + relaunch E2E
**BP:** IDE-E07-F06 · **Hat:** FE+QA · **P:** P0 · **Est:** S · **Deps:** CD-131, CD-136, CD-204
**Do:** Session blob (workspace, panels, selection, zoom) written debounced, restored at boot stage 4; corrupt-session fallback + notice; Playwright relaunch test.
**AC:**
- [x] quit/relaunch restores exact state (E2E green)
- [x] corrupt blob → defaults + notification

**Notes (2026-07-15):** `ide/src/services/session/`. `SessionManager` — `load()` reads `cdk-session` (parse + shape + version checks; **corrupt/unexpected/version-mismatch → null + `corrupt-session` notice**; absent → null, no notice), `save({activeWorkspace, selection, zoom})` debounced write-behind, `flush()` for quit. Wired into `boot-sequence.ts` as a **blocking `session-restore` phase (boot stage 4)**: restores the last active workspace + editor zoom/selection, then subscribes workspace + editor changes → debounced `session.save`. App flushes on `beforeunload`. Unit tests: save/load round-trip, debounce+flush, corrupt-JSON/bad-shape/bad-version → null+notice, absent→no-notice. **E2E**: switch to Flows → reload → **Flows restored** (aria-selected); and **corrupt `cdk-session` → boots to default Home, no crash**. Also **hardened the CD-117 grep guard** to strip comments (it false-matched "localStorage" in prose twice). 341 vitest + 5 E2E green.

### CD-213 · Resizable panels
**BP:** IDE-E08-F01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-203
**Do:** Drag handles on L/R panels (180–480 px clamp) writing Workspace-store widths; ⌘B/⌘J hide/show; reopen affordance when hidden; per-workspace persistence.
**AC:**
- [x] persist/restore test per workspace; keyboard + palette commands exist

**Notes (2026-07-15):** `ide/src/workspaces/panels/`. `panels-model.ts`: per-workspace `PanelState {leftWidth,rightWidth,leftVisible,rightVisible}` over a persisted store; `clampWidth` [180,480], `setPanelWidth`/`togglePanel`/`setPanelVisible`/`panelFor` (defaults for unseen workspaces). `ResizablePanel`: drag handle (pointer resize) + **keyboard resize** (Arrow keys on the `role="separator"`, ±16px, clamped, aria-valuenow/min/max); hidden → **reopen strip** affordance. **Wired into the shell**: `boot-sequence.ts` creates a persisted `panels` store + a `StoreManager` (`panels-restore` phase restores it) and exposes a combined `flush()`; **App refactored into a boot-loader + `Shell` component** (kernel non-null) rendering a left Explorer panel, `useStore(panels)`, ⌘B/⌘J toggle, palette togL/togR routed, resize→`setPanelWidth`. `beforeunload` flushes session + panels. Unit tests: clamp, per-workspace independent widths, toggle, component width/keyboard-resize/reopen. **E2E**: Ctrl+B hides the panel + reopen appears, and **hidden state persists across relaunch** (needed the beforeunload flush — debounced write was being lost). 347 vitest + 6 E2E green.

### CD-214 · DockManager model
**BP:** IDE-E08-F02-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-130
**Do:** Tool-window state machine `{mode: float|docked, side, size, pinned, autohidden}`; transitions (float↔dock↔pin↔auto-hide↔peek); persistence rows in Workspace store.
**AC:**
- [x] state machine fully unit-tested (every transition + illegal transitions rejected)

**Notes (2026-07-15):** `ide/src/platform/dock/`. `DockManager` — pure serializable state machine; each `ToolWindow {id, mode:float|docked, side:left|right|bottom, size, pinned, autohidden, peeking}`. `register` (docked+pinned default, size clamped to minSize; dupe rejected). Transitions: `float`/`dock(side)`/`moveZone(side)`/`pin`/`unpin`(→auto-hidden edge tab)/`peek`/`unpeek`/`resize`(minSize clamp). **Illegal transitions throw `DockError`**: float-when-floating, dock-same-side, move/pin/unpin on a floating window, pin-when-pinned, unpin-when-unpinned, peek-a-pinned-window, unpeek-when-not-peeking, unknown-window. `serialize`/`hydrate` round-trip for persistence as Workspace-store rows. 14 tests covering every legal transition + all illegal rejections + persistence round-trip. Dock **UI** (zones/insets/auto-hide/peek rendering) is CD-215; declarative registration proof is CD-216. 361 vitest green.

### CD-215 · Dock UI: zones, insets, auto-hide/peek
**BP:** IDE-E08-F02-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-214, CD-213
**Do:** Header drag → zone overlay (L/R/bottom/float) with hot-zone highlight; pinned rails inset the content area; unpinned collapse to edge tabs with hover-peek; rail resize handles; float-back.
**AC:**
- [x] Playwright journey: dock → pin → auto-hide → peek → re-pin → float → relaunch-restore
- [x] insets computed correctly with both rails pinned

**Notes (2026-07-16):** `ide/src/workspaces/dock/`. `DockHost` renders each `ToolWindow` per the CD-214 `DockManager` state: **pinned docked → rail** (header + body, sized by side), **unpinned docked → edge tab with peek** (hover/click shows a peek body), **float → floating window** with dock-back controls. Header controls (keyboard-operable buttons) drive the transitions — a zone-chooser stands in for the design's drag-to-zone overlay (drag can layer on later; buttons keep the journey reliable + accessible). `computeInsets(windows)` sums **pinned docked** rail sizes per side (ignores unpinned/floating). **Wired into the shell**: `boot-sequence.ts` registers a **Live Mirror** tool window on a `DockManager`, persists `dock.serialize()` to a `cdk-dock` store via the StoreManager (`saveDock`), and hydrates it in the panels-restore phase; App renders `DockHost` and re-reads on `onChange`. Tests: `computeInsets` (both rails pinned → both sides; unpin/float drop insets), full lifecycle harness (rail→auto-hide→peek→re-pin→float→dock-left). **E2E**: the full journey **incl. relaunch restoring the floating state**. 363 vitest + 7 E2E green.

### CD-216 · Declarative dock registration + proof window
**BP:** IDE-E08-F02-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-214
**Do:** `dock.register({id, defaultSide, minSize})`; register a dummy second tool window proving zero new dock code per window.
**AC:**
- [x] dummy window docks/pins/peeks purely via registration

**Notes (2026-07-16):** `DockManager.register({id, defaultSide, minSize, defaultSize?})` is the declarative contribution point (built in CD-214). Proof: registered a second **Minimap** tool window in `boot-sequence.ts` (`defaultSide: left`) — the ONLY per-window code is the registration + a content entry in the DockHost map; it docks/pins/peeks/floats through the same `DockManager` + `DockHost` with **zero bespoke component code**. `declarative-registration.test.tsx` registers a brand-new `dummy` window and drives its full lifecycle (rail → auto-hide → peek → re-pin → float) via the generic host. Shell now hosts two tool windows; build + all 7 E2E green. 364 vitest green.

### CD-217 · Layout presets
**BP:** IDE-E08-F03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-213, CD-215
**Do:** Preset = config `{lpw, rpw, hideL, hideR, docks}`; built-ins (Balanced/Focus/Inspector/Explorer/Docked Tools); manual change flips label to "Custom"; save/delete user presets; status-bar menu + ⌥⌘P + palette.
**AC:**
- [x] round-trip test; per-workspace independence test

**Notes (2026-07-16):** `ide/src/workspaces/panels/layout-presets.ts`. `LayoutPreset {name, lpw, rpw, hideL, hideR}`; 5 built-ins (Balanced/Focus/Explorer/Inspector/Docked Tools). `applyPreset(store, workspaceId, preset)` writes the workspace's panel widths+visibility; `currentPresetName(state, workspaceId, presets)` matches against built-ins+user → **`Custom`** when nothing matches; `capturePreset` snapshots current state as a user preset. `LayoutPresetMenu` (status-bar): shows the current preset, applies on click, offers **Save current as preset** when Custom, and delete for user presets. **Wired into the shell footer** next to the StatusBar; user presets persist in a `cdk-presets` store (StoreManager). Tests: apply→match round-trip (Focus hides both / Balanced restores), **manual change → Custom**, **per-workspace independence** (flows=Focus, variables=Explorer), menu apply, save-when-Custom captures the width + delete round-trip. 369 vitest + 7 E2E green. (⌥⌘P/palette `layout` command exists; opening the menu via it can layer on — the menu is a status-bar control today.)

### CD-218 · Honest-stub sweep + placeholder panes
**BP:** IDE-E07 AC / AUDIT C5 · **Hat:** FE+DES · **P:** P1 · **Est:** S · **Deps:** CD-203, CD-211
**Do:** Placeholder content for all seven panes ("arrives in M3/M4" affordance); sweep chrome for dead controls — each works, is disabled-with-tooltip, or is removed.
**AC:**
- [ ] click-everything audit recorded: zero silent controls

### CD-219 · **M2 gate review**
**BP:** Blueprint M2 gate · **Hat:** PM+QA · **P:** P0 · **Est:** S · **Deps:** CD-201…218
**Do:** Demo + record: workspace journeys, palette-everything, prefs, docking, restart restore, keyboard-only walkthrough.
**AC:**
- [ ] Playwright journey suite green (nav/palette/prefs/dock/session)
- [ ] keyboard-only walkthrough of the full chrome recorded
- [ ] workspace switch < 100 ms measured; chunk budgets green
