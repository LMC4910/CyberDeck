# M2 — Shell & Chrome (CD-201…219)

**Gate:** all seven workspaces navigable (empty panes allowed) · palette executes every registered command · prefs/keyboard/rebinding live · docking + presets + session restore survive relaunch · every visible control operable or honestly disabled · chrome keyboard-complete.
**Entry:** CD-139 passed. **Exit:** CD-219 recorded.

## Board

- [x] CD-201 A11y primitives library — ✅ Done 2026-07-15
- [x] CD-202 WorkspaceService + contribution registry — ✅ Done 2026-07-15
- [ ] CD-203 Workspace rail + lazy pane host
- [ ] CD-204 Per-workspace context preservation + nav history
- [ ] CD-205 Breadcrumb + status bar
- [ ] CD-206 Command palette UI
- [ ] CD-207 Palette recents + groups
- [ ] CD-208 Preferences shell + general/appearance panes
- [ ] CD-209 Keyboard pane + rebind UX
- [ ] CD-210 Settings search
- [ ] CD-211 NotificationService + toasts + drawer
- [ ] CD-212 Session restore + relaunch E2E
- [ ] CD-213 Resizable panels
- [ ] CD-214 DockManager model
- [ ] CD-215 Dock UI: zones, insets, auto-hide/peek
- [ ] CD-216 Declarative dock registration + proof window
- [ ] CD-217 Layout presets
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
- [ ] each pane is its own chunk (bundle analysis assertion)
- [ ] rail keyboard-operable; WorkspaceChanged fires on switch

### CD-204 · Per-workspace context preservation + nav history
**BP:** IDE-E07-F01-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-203
**Do:** Context snapshot map (scroll/zoom/selection) per workspace; back/forward stack with ⌘[ / ⌘] commands.
**AC:**
- [ ] switch→return restores context (test)
- [ ] history walk test across ≥3 workspaces

### CD-205 · Breadcrumb + status bar
**BP:** IDE-E07-F02 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-203
**Do:** Breadcrumb (`Project › Workspace › Selection`, clickable) and status bar as pure store subscribers; per-workspace segment registry (design mapping); saved-state indicator from ConfigurationService write-behind.
**AC:**
- [ ] no imperative sync calls (subscriber pattern only — code review checklist)
- [ ] segments swap per workspace; crumb segments navigate

### CD-206 · Command palette UI
**BP:** IDE-E07-F03-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-121, CD-201
**Do:** ⌘K overlay (focus-trapped) rendering context-filtered registry commands; fuzzy scorer; virtualized list; Enter executes / Esc restores focus; shortcut hints from keymap.
**AC:**
- [ ] every registered command reachable + executable from the palette (test iterates registry)
- [ ] keyboard-complete; axe clean

### CD-207 · Palette recents + groups ∥
**BP:** IDE-E07-F03-T02 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-206
**Do:** Recent-weighting (persisted), category group headers matching design.
**AC:**
- [ ] recents float after use; groups match design ordering

### CD-208 · Preferences shell + general/appearance panes
**BP:** IDE-E07-F04-T01 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-118, CD-134, CD-201
**Do:** Prefs window (focus-trapped); General + Appearance panes; every control writes through ConfigurationService (no local state); theme picker drives ThemeService.
**AC:**
- [ ] round-trip persist test (change → relaunch → value holds)
- [ ] zero local component state for settings (review checklist)

### CD-209 · Keyboard pane + rebind UX
**BP:** IDE-E07-F04-T02 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-208, CD-122
**Do:** Keyboard pane rendered from the command registry (single source); rebind flow with conflict warning; reset-to-default.
**AC:**
- [ ] rebind persists + takes effect without reload; conflict surfaced

### CD-210 · Settings search ∥
**BP:** IDE-E07-F04-T03 · **Hat:** FE · **P:** P2 · **Est:** S · **Deps:** CD-208
**Do:** Search filters panes/rows by label + keywords.
**AC:**
- [ ] matches pane content; keyboard navigable results

### CD-211 · NotificationService + toasts + drawer
**BP:** IDE-E07-F05 · **Hat:** FE · **P:** P1 · **Est:** M · **Deps:** CD-120, CD-130, CD-201
**Do:** `notify({priority, source, actions})` → queue with dedupe + rate-limit; toast renderer (undoable-action affordance wired to CD-123 payloads); drawer as Notification-store projection; toast policy per AUDIT M4 (no ambient-success noise).
**AC:**
- [ ] dedupe/rate-limit tests; undo toast triggers undo
- [ ] drawer mark-all-read works; keyboard operable

### CD-212 · Session restore + relaunch E2E
**BP:** IDE-E07-F06 · **Hat:** FE+QA · **P:** P0 · **Est:** S · **Deps:** CD-131, CD-136, CD-204
**Do:** Session blob (workspace, panels, selection, zoom) written debounced, restored at boot stage 4; corrupt-session fallback + notice; Playwright relaunch test.
**AC:**
- [ ] quit/relaunch restores exact state (E2E green)
- [ ] corrupt blob → defaults + notification

### CD-213 · Resizable panels
**BP:** IDE-E08-F01 · **Hat:** FE · **P:** P0 · **Est:** S · **Deps:** CD-203
**Do:** Drag handles on L/R panels (180–480 px clamp) writing Workspace-store widths; ⌘B/⌘J hide/show; reopen affordance when hidden; per-workspace persistence.
**AC:**
- [ ] persist/restore test per workspace; keyboard + palette commands exist

### CD-214 · DockManager model
**BP:** IDE-E08-F02-T01 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-130
**Do:** Tool-window state machine `{mode: float|docked, side, size, pinned, autohidden}`; transitions (float↔dock↔pin↔auto-hide↔peek); persistence rows in Workspace store.
**AC:**
- [ ] state machine fully unit-tested (every transition + illegal transitions rejected)

### CD-215 · Dock UI: zones, insets, auto-hide/peek
**BP:** IDE-E08-F02-T02 · **Hat:** FE · **P:** P0 · **Est:** M · **Deps:** CD-214, CD-213
**Do:** Header drag → zone overlay (L/R/bottom/float) with hot-zone highlight; pinned rails inset the content area; unpinned collapse to edge tabs with hover-peek; rail resize handles; float-back.
**AC:**
- [ ] Playwright journey: dock → pin → auto-hide → peek → re-pin → float → relaunch-restore
- [ ] insets computed correctly with both rails pinned

### CD-216 · Declarative dock registration + proof window
**BP:** IDE-E08-F02-T03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-214
**Do:** `dock.register({id, defaultSide, minSize})`; register a dummy second tool window proving zero new dock code per window.
**AC:**
- [ ] dummy window docks/pins/peeks purely via registration

### CD-217 · Layout presets
**BP:** IDE-E08-F03 · **Hat:** FE · **P:** P1 · **Est:** S · **Deps:** CD-213, CD-215
**Do:** Preset = config `{lpw, rpw, hideL, hideR, docks}`; built-ins (Balanced/Focus/Inspector/Explorer/Docked Tools); manual change flips label to "Custom"; save/delete user presets; status-bar menu + ⌥⌘P + palette.
**AC:**
- [ ] round-trip test; per-workspace independence test

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
