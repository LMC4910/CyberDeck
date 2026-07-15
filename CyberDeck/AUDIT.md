# CyberDeck Designer — IDE UX & Architecture Audit

**Audited artifact:** `CyberDeck IDE (Phase 4).dc.html` (4,340 lines; ~950 lines CSS, ~850 lines markup, ~2,530 lines logic in one `Component` class)
**Audit date:** 2026-07-07 · **Re-verified against live source:** 2026-07-07
**Scope:** Every workspace, panel, overlay and the JS architecture. No new features proposed — only cohesion, interaction quality, and architecture.
**Purpose:** Source material for the next ROADMAP phases.
**Verification status:** All Critical and High findings below were re-checked against the current file line-by-line (see §10 Code Verification Log for exact line references). No findings have been resolved since the first pass — every v3 phase (23–31) is still `○` in ROADMAP.md, so this audit remains fully current.

---

## 1. Executive Summary

CyberDeck Designer has an unusually deep feature set for a design-tool mockup — components/variants/overrides, bindings, states, flows with test-run, shared styles, symbols, theming — and a consistent visual language (dark cyber, `--accent`/`--ink`/`--line` tokens, Rajdhani/JetBrains Mono/Exo 2). The Design workspace is genuinely close to desktop-grade: pan/zoom, marquee/lasso, smart guides, minimap, selection minibar.

What holds it back from feeling like **one application** rather than seven good screens:

1. **No undo/redo.** Confirmed: zero history infrastructure anywhere. This is the single largest gap between "demo" and "IDE" — every destructive action (delete, detach, ungroup, variant delete) is irreversible.
2. **No central state or selection manager.** State lives in five places at once: DOM classes (`.sel`, `.on`, `.locked`), `data-*` attributes (`data-lkid`, `data-variant`, `data-master`), ~20 ad-hoc instance fields (`_varReg`, `_binds`, `_states`, `_events`, `_cmRow`, `_running`…), six unrelated localStorage keys, and hardcoded HTML. Cross-panel sync is done by manually calling `syncSelBox()` + `syncCompSec()` + `syncCrumb()` + `updateMinimap()` at every mutation site — miss one call and panels silently drift.
3. **Fixed, non-dockable panels.** `.lpanel` is hardcoded 252px, `.rpanel` 290px. Nothing resizes, docks, floats, collapses, or remembers layout. ⌘B/⌘J only hard-hide.
4. **The Inspector is widget-agnostic.** A gauge, a button, a text label, and a chart all get the identical Layout/Constraints/Appearance sections. Only the Component and multi-select sections are contextual. There is no empty-selection (page properties) state.
5. **Half the chrome is decorative.** Window controls, Share, Import, Export, Rotate, Resync, Pause/Step/Clear, table sorting, variable inline-edit, notifications actions — visible but inert. In a web dashboard that's a mockup convention; in a desktop IDE every visible control must respond or be disabled with a reason.
6. **Workspaces still behave like pages.** Switching workspace resets local context (Flows test-run is force-stopped, scroll positions lost, no per-workspace zoom memory, no back/forward history). The breadcrumb only shows the workspace name, not the real path (`Battlestation › Dashboard › Perf Group`).

The application is roughly **70% of the way visually and 35% architecturally** to a production IDE. The highest-leverage investments, in order: central state + selection manager → undo/redo → docking/resizing → contextual inspector → dead-control cleanup.

---

## 2. Scores

| Dimension | Score | Rationale |
|---|---|---|
| UX | 6.5/10 | Strong canvas interactions and shortcuts; broken by irreversibility and dead controls |
| UI | 7.5/10 | Cohesive theme and tokens; 6 competing tab/segment patterns, duplicate CSS blocks |
| Desktop IDE feel | 5/10 | Fixed panels, no docking, no undo, no window/session memory |
| Architecture | 3.5/10 | One 2,500-line god-class, imperative DOM as the data model |
| State management | 3/10 | Five parallel stores, no subscriptions, manual sync fan-out |
| Accessibility | 2/10 | Div-buttons, no focus-visible, no roles/aria, no keyboard reachability outside custom shortcuts |
| Performance | 6/10 | Fine at current scale; `lucide.createIcons()` full-document rescans and per-pointermove layout reads won't scale |
| Responsiveness (window sizes) | 5/10 | Fixed px panels + 640px board work only in a wide window; no min-width handling |
| **Overall readiness** | **4.5/10** | Excellent mockup, pre-production architecture |

---

## 3. Critical Issues

### C1 — No undo/redo system
- **Issue:** No history stack exists anywhere in the codebase. The only things matching `history` are cosmetic: the `_selHist` **selection** ring walked by `stepSel()` (line 2750) with the `[`/`]` keys, the decorative "Version History" list on the Dashboard (line 1061), the Timeline overlay (line 1633), and the `history` lucide icon in the top/status bar (lines 982, 1568). None capture a reversible mutation — delete, detach, ungroup, variant delete (line 2647), override reset (line 2613) all mutate the DOM directly with no snapshot and no inverse.
- **Why it's wrong:** Undo is the psychological safety net that makes users explore. Without it every action carries risk, which reads as "toy," not "tool."
- **Expected IDE behavior:** Central command/history stack; every mutation is a reversible command object; ⌘Z/⇧⌘Z global; history panel optional (Timeline already exists as the UI surface for this).
- **Fix:** Introduce a `Commands` layer: every mutation goes through `exec({do, undo, label})`. Wire ⌘Z/⇧⌘Z, show the last command label in a toast ("Deleted GPU gauge — ⌘Z to undo"), and feed the Timeline panel from the same stack.
- **Priority: Critical**

### C2 — No global selection manager
- **Issue:** Selection is encoded as `.sel`/`.on` classes on whichever DOM tree happens to render it (canvas `.wt.sel`, layers `.lyr.sel`, vars `.vrow.sel`, devices `.dcard.sel`). Sync is a manual fan-out: `syncSelBox()` (line 3178) itself calls `updateMinimap()`+`updateMirror()`+`updateMinibar()`; `syncCompSec()` (line 2672) calls `syncCrumb()`+`syncVariants()`+`syncOverrides()`. These are hand-invoked from ~30 mutation sites (syncSelBox alone at lines 1891, 2013, 2814, 2834, 2857, 3093, 3207, 3248, 3277…). Miss one and a panel silently drifts — e.g. the layer `⌘`-click at line 2304 calls only `syncCompSec()`, not the box/minimap sync.
- **Why it's wrong:** Every new feature must remember to call every sync function. Bugs already latent: selecting a variable row doesn't update the Design breadcrumb; selecting in the minimap doesn't update the status bar; Flows selection and Design selection are unrelated systems.
- **Expected IDE behavior:** One `SelectionManager` (`{type: 'widget'|'node'|'var'|'device', ids: []}`) that panels *subscribe* to. Layers, Inspector, breadcrumb, status bar, minibar, minimap, Flows inspector all react to one event.
- **Fix:** Central `AppState.selection` + `subscribe(fn)`; convert each `sync*` function into a subscriber; mutation sites only ever call `setSelection()`.
- **Priority: Critical**

### C3 — DOM is the data model
- **Issue:** The document itself is the project database. Widget identity is `data-lname` strings; component relationships are `data-master`/`data-lkid` attributes; locks persist to localStorage *by display name* (`cdk-locked` stores name strings — two layers named "Button" collide). Registries (`_varReg`, `_binds`, `_states`, `_events`) are keyed inconsistently (lkid vs lname).
- **Why it's wrong:** Rename breaks locks/bindings; duplicate names corrupt state; no serialization path to a real project file; every read requires a `querySelector`.
- **Expected IDE behavior:** A document model (widgets, layers, components, bindings as plain objects with stable UUIDs) that renders *to* the DOM. Figma/Blender/Unreal never store truth in the view.
- **Fix:** Introduce `ProjectModel` with stable ids; DOM elements carry only `data-id`; all registries key on id; a single `render(dirtyIds)` reconciles. Migrate incrementally: layers + canvas widgets first (they share identity already), then bindings/states/events.
- **Priority: Critical**

### C4 — Panels don't dock, resize, or remember
- **Issue:** `.lpanel{width:252px}` `.rpanel{width:290px}` are fixed. No drag-to-resize edges, no collapse rails, no float/pin, no auto-hide. ⌘B/⌘J hide panels via `hideL/hideR` classes but the state isn't persisted across reloads. Live Mirror floats and drags but cannot dock, close, resize, or switch device. Minimap collapses but its two CSS definitions disagree about which corner it lives in (see H8).
- **Why it's wrong:** Panel control is *the* defining trait of desktop IDEs. A fixed 290px inspector wastes space on a 4K display and truncates on a laptop.
- **Expected IDE behavior:** VS/JetBrains-style: every tool window supports resize (drag edge), collapse (to icon rail), float, close/restore (View menu or palette), with layout persisted per workspace.
- **Fix:** Minimum viable docking: (a) 4px drag handles on inner edges of `.lpanel`/`.rpanel` writing a CSS var, (b) persist widths + hidden state + Live Mirror position/collapsed + minimap collapsed to one `cdk-layout` key, (c) close buttons on Live Mirror/minimap with palette commands to restore. Full dock/float engine is a later phase.
- **Priority: Critical**

### C5 — Dead controls throughout the chrome
- **Issue:** Non-functional but fully styled: window min/max/close, Share, Projects Import, project-row "…" menus, Browse table sorting, Devices Rotate/Resync/Present-to-All, Runtime Pause/Step/Clear, Vars New Variable/Graph/search, Library asset "Add Assets", notification "Install & Restart"/"Mark all read", Timeline Compare/Restore, prefs "Edit" shortcut buttons, Constraints segments, Appearance Fill/Radius controls (visual only).
- **Why it's wrong:** Desktop software has a contract: visible = operable (or visibly disabled). Every silent click erodes trust and makes the app feel like a picture of an app.
- **Expected IDE behavior:** Controls either work, show disabled affordance with tooltip ("Requires engine connection"), or don't exist.
- **Fix:** Triage all ~40 dead controls into: wire (cheap — sorting, Clear log, Mark all read, search fields), stub with honest disabled state + tooltip, or remove. Track as one checklist phase.
- **Priority: Critical**

---

## 4. High Priority Issues

### H1 — Inspector is not contextual
- **Issue:** One selected widget always shows Layout, Component (if applicable), Constraints, Appearance, Shared Styles, Bindings, States, Events — identical for a gauge, button, text, image, chart. Empty selection shows a stale inspector (last widget's values) instead of Page/Artboard properties.
- **Expected:** Selection type drives section list: Gauge → value binding, range, arc style; Button → label, icon, action; Text → typography; nothing → page grid/background; multi → existing align/distribute section (already good).
- **Fix:** Inspector = `sectionsFor(selection)` registry keyed by widget type from the component registry (types already exist in the Insert browser data). Rebuild sections from the registry on selection change; add the missing "no selection → Page Properties" state.
- **Priority: High**

### H2 — Flows graph lacks pan/zoom and graph-level navigation
- **Issue:** The Design canvas got a full pan/zoom world (Phase 17) but `.fgraph` has none — no wheel pan, no ⌘-wheel zoom, no zoom-to-fit, no minimap. Also no marquee multi-select of nodes, no multi-node drag, no ⌘D duplicate node.
- **Expected:** Node editors (Unreal Blueprint, Node-RED) treat the graph as an infinite canvas with the same nav vocabulary as the design canvas.
- **Fix:** Reuse the Phase 17 world-transform code (extract it into a shared `PanZoomSurface` used by both canvas and fgraph). Add marquee select + multi-drag using the Phase 7 selection engine primitives.
- **Priority: High**

### H3 — Flow node/edge geometry is fragile
- **Issue:** Nodes are fixed `width:180px` and ports are absolutely positioned at `top:11px`, so edges always leave from the header regardless of node content height; condition true/false branches exit the same point. Long target chips ellipsize awkwardly.
- **Expected:** Ports anchored per-row (Unreal: one port per pin, vertically distributed); edges recompute from port positions, not node origin.
- **Fix:** Compute port anchor from the port element's own bounding box (already rendered) instead of node x/y + constant; give conditions two out-ports (true/false) stacked on the right edge.
- **Priority: High**

### H4 — No workspace/session continuity
- **Issue:** Switching workspaces discards context: scroll positions reset, Flows test-run force-stops, Design zoom/pan is kept but not persisted across reload; active workspace, active library tab, prefs pane all reset on reload. No back/forward navigation, breadcrumb is workspace-name-only and not clickable.
- **Expected:** JetBrains/VS restore the exact session: workspace, panel layout, selection, scroll. Breadcrumbs are navigable paths (`Battlestation › Dashboard › Perf Group`), and ⌘[ / ⌘] walk navigation history.
- **Fix:** One `cdk-session` blob (workspace, lib tab, zoom/pan, panel layout, selection id) written on change, restored on mount. Make top-bar breadcrumb render from AppState (project › page › selection) with clickable segments. Add a navigation history stack behind back/forward.
- **Priority: High**

### H5 — God-class architecture
- **Issue:** One `Component` class: ~150 methods, ~2,530 lines, mixing selection, layers, canvas math, flows model, variants, overrides, bindings, states, events, themes, tour, wizard, palette, toasts. Helpers `$`/`$$` make every method a live DOM query. Features communicate by calling each other's methods directly.
- **Why it's wrong:** Every phase increases coupling; regressions already require whole-file reasoning; two people cannot work in it; the file is at the practical edit limit.
- **Expected:** Modules with owned state: `SelectionManager`, `LayersController`, `CanvasController`, `FlowsModel`, `BindingStore`, `ThemeManager`, communicating via the central store/events.
- **Fix:** Extract pure-logic modules into plain `.js` helper files (flows model, component registry, binding store are the easiest — they're already registry-shaped) loaded via `x-import`; keep DOM controllers thin.
- **Priority: High**

### H6 — Accessibility is absent
- **Issue:** Every button is a `<div>`/`<span>`/`<i>` with a click handler. No `tabindex`, no `:focus-visible` styles, no roles, no aria-labels on icon-only buttons, no Esc/focus-trap management in modals (scrim click + Esc work, but focus escapes into the page behind), contenteditable renames have no accessible name, color is the only signal for status dots.
- **Expected:** IDE users are keyboard-heavy. Figma/VS Code are fully traversable: Tab reaches every control, focus rings are visible, overlays trap focus.
- **Fix:** Pass 1 (cheap, high value): global `:focus-visible` style on interactive classes; `tabindex="0"` + `role="button"` + `aria-label` on `.iconbtn/.tool/.rb/.sbi/.chip`; Enter/Space activation in the existing delegated click handler; focus trap + focus restore in `.ovl` overlays. Pass 2: layer tree as `role="tree"`, tabs as `role="tablist"`.
- **Priority: High**

### H7 — Seven competing tab/segment patterns
- **Issue:** Confirmed seven distinct implementations, each with its own heights/radii/active treatment: `.segc` (inset segments, line 122), `.itabs` (underline, line 129), `.ftabs` (pill, line 261), `.density`/`.dseg` (bordered pill, line 359), `.bmodes` (popover mode switch, line 396), `.fpseg` (flow-param segments, line 504), `.dtabs` (underline, line 691). The two underline tab styles (`.itabs` 11px×13px padding vs `.dtabs` 8px×12px) differ by a few px for no reason.
- **Expected:** One tab component and one segmented-control component, reused. Users subconsciously read consistency as quality.
- **Fix:** Consolidate to two classes: `.tabs` (navigational, underline) and `.segc` (mode switch, inset). Migrate `.dtabs/.itabs/.ftabs` → `.tabs`; `.density/.bmodes/.fpseg` → `.segc`.
- **Priority: High**

### H8 — Duplicate/conflicting CSS blocks
- **Issue:** Six selectors are each defined **twice** with conflicting values — the later (Phase 13 block, ~line 337+) wins over the earlier (Phase 18/19 block, ~line 195+):
  - `.minimap` — line 196 says `right:14px;bottom:14px;width:172px` (no height); line 339 says `left:14px;bottom:14px;width:160px;height:112px`. **The left/bottom-corner version wins**, which is why the minimap sits bottom-left despite the first block.
  - `.minibar` — line 211 (`z-index:12`, icons `15px`, gap `1px`) vs line 344 (`z-index:38`, icons `24px`, gap `2px`).
  - `.floatp` — line 220 (`right:14px;top:14px;width:218px;z-index:9`) vs line 349 (`right:20px;bottom:20px;width:210px;z-index:35`).
  - `.mm-stage` — line 205 vs 340; `.canvas.pan` — line 193 vs 338 (identical, harmless but dead); `.fnode.run` — line 287 (`box-shadow … rgba(0,0,0,.5)`) vs line 317 (green glow + `z-index:6`).
- **Why it's wrong:** Unpredictable overrides, dead CSS weight, and any future edit to the losing block silently does nothing.
- **Fix:** Deduplicate the six selectors; keep the later (active) values; delete the Phase 18/19 orphans.
- **Priority: High**

### H9 — Live Mirror is not a tool window
- **Issue:** Drags within the canvas only, cannot be closed, docked, resized, or switched to another device; content is a fake mini-grid rather than the actual board state (a second `.fp-mini` variant is hardcoded); no restore command if it could be closed.
- **Expected:** Tool-window contract: close (×), reopen via palette/status bar, dock to a corner with snap, remember position, and a device dropdown in its header.
- **Fix:** Add close + palette "Toggle Live Mirror"; snap-to-corner on drag end; render its stage from the same board model the minimap uses (one source); device switcher reusing `selDevice()`.
- **Priority: High**

### H10 — Variables workspace is display-only
- **Issue:** FEATURES.md specifies inline edit, multi-select, sorting, filtering, import/export; the built table is 8 hardcoded rows, search input inert, "New Variable" inert, no context menu, right inspector hardcoded to `gpu.load` regardless of selected row.
- **Expected:** Variables are the nervous system of this product (bindings, flows, runtime all reference them). The manager must at least select→inspect correctly and filter.
- **Fix:** Drive rows from the same variable catalog the binding popover already uses (`allVars()` exists!); wire search/scope filters; make the inspector render the selected variable; inline value edit for non-plugin scopes.
- **Priority: High**

---

## 5. Medium Priority Issues

### M1 — Canvas widgets live in two layout systems
The board is a CSS grid (`grid-template-columns:repeat(4,1fr)`) but drag/resize (Phase 6) switches it to `.board.free{display:block}` absolute positioning. Inspector X/Y/W/H values are seeded as literals (`value="16"`) that don't match grid reality until first drag. **Fix:** one authoritative layout mode (absolute with grid snapping) seeded from the model. **Priority: Medium**

### M2 — Status bar is Design-biased and partially stale
Cursor readout, snap toggle, and selection label are Design-only concepts but persist while in Runtime/Vars, showing stale data. **Fix:** status bar segments subscribe to AppState and swap per workspace (Flows: node count/armed; Runtime: events/min). **Priority: Medium**

### M3 — Context menu is one-size-fits-all
The layers context menu (with Create Component, variants, label colors) is reused for canvas right-click; irrelevant rows are shown-but-toasted rather than hidden (e.g. "Go to Master" on a non-instance). **Fix:** build menu rows from selection capabilities; hide, don't excuse. **Priority: Medium**

### M4 — Toast overuse for state that should be ambient
Density change, theme change, device select, snapping toggle all fire toasts; the toast is also the only feedback for errors ("Select a group first"). **Fix:** reserve toasts for async/undoable outcomes (with undo affordance per C1); inline validation for errors near the control; no toast for visible state changes. **Priority: Medium**

### M5 — Overlay stacking and z-index management is ad hoc
Scattered constants: minibar 12/38, minimap 8/36, drawer 95, palette 100, bpop 120, toast 120, tour 130, cmenu 140, cbprev 150, spick 160. Toast and bpop collide at 120; two overlay systems (`.ovl` and free-floating `.cmenu/.bpop/.spick`) each implement own dismissal. **Fix:** z-index scale tokens (`--z-panel/–popover/–modal/–toast`) and one popover manager handling Esc/outside-click/scroll-close. **Priority: Medium**

### M6 — `lucide.createIcons()` global rescan after every mutation
`icons()` is called ~30 times (every menu open, layer add, workspace switch) and rescans the whole document. **Fix:** call `createIcons({root: mutatedEl})` scoped to the changed subtree, or inline SVGs at build time for static chrome. **Priority: Medium**

### M7 — Pointer-move work is unthrottled
Canvas `onPointerMove` updates cursor readout, and drag paths call `syncSelBox`/`updateMinimap` with fresh `getBoundingClientRect` reads per event. Fine now; will jank with real widget counts. **Fix:** rAF-batch move handlers; cache board rect per gesture. **Priority: Medium**

### M8 — Expression evaluation uses live JS eval
`evalExpr` substitutes variable values into the string and evaluates it. In a shipped app that's an injection/perf hazard and error messages leak JS internals. **Fix (design-level):** note in the spec that production needs a sandboxed expression parser; in the mockup, catch and prettify errors ("Unknown variable 'fps.max'"). **Priority: Medium**

### M9 — Inconsistent radius/spacing scale
Radii in use: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22px. Icon sizes: 11–20px in 1px steps. Heights: buttons 24/26/28/29/30/32px. **Fix:** tokenize (`--r-s:7px; --r-m:10px; --r-l:14px`; control heights 24/28/32) and sweep. Perceived quality gain is large for mechanical work. **Priority: Medium**

### M10 — Projects "Browse" table and Dashboard cards are static
Sorting headers don't sort, "…" menus dead, right-panel project inspector hardcoded to Battlestation, hero card CTA works but template cards all open the same wizard state. **Fix:** minimal model array → render; row select drives inspector; sort on header click. **Priority: Medium**

### M11 — Devices workspace mocks don't reflect the document
Device mockups are hand-drawn `.mgrid` blocks unrelated to the actual Dashboard board; editing the board doesn't update Preview or Live Mirror. **Fix:** render device mocks and Live Mirror from the same board model (one `renderBoardThumb(target, scale)`). **Priority: Medium**

### M12 — Modals lack standard desktop behaviors
No focus trap (H6), wizard doesn't validate before Continue, no Enter-to-confirm/Esc distinction on final step, Preferences search inert, no unsaved-changes guard concept. **Fix:** shared modal controller: focus trap, Enter/Esc semantics, dirty-guard hook. **Priority: Medium**

### M13 — Beginner/Power density hides sections without signposting in the Inspector
`pro-only` sections vanish entirely in Beginner; the hint lives only in the Layers panel. A beginner selecting a widget with live bindings sees no trace of them. **Fix:** collapsed "Advanced (Power mode)" stub row in the inspector when hidden content exists. **Priority: Medium**

### M14 — Keyboard shortcut registry is triplicated
Shortcuts are declared in the keydown handler, repeated as `.kbd` labels in palette rows/tooltips, and listed again in Preferences → Keyboard. Three sources already disagree (⌘K ⌘S is labeled but not implemented). **Fix:** one `COMMANDS` array (id, label, keys, handler) that drives the keydown handler, palette rows, tooltips, and prefs list. This also unlocks C5 cleanup and user rebinding later. **Priority: Medium**

---

## 6. Low Priority Issues

- **L1 — Window controls are fake.** min/□/× do nothing; in a web-delivered design they should be omitted or clearly presentational. Remove or wire × to a "close project?" dialog.
- **L2 — Avatars/collaborators are decorative** with no presence model or tooltip; add names on hover or drop.
- **L3 — `.bname s` / `.kv s` misuse of `<s>` element** (strikethrough tag repurposed via `text-decoration:none`) — harmless visually, hostile to a11y/semantics; replace with `<span class>`.
- **L4 — Rename UX quirks:** contenteditable spans allow newlines/formatting paste; Enter commits but Esc also commits (should cancel).
- **L5 — Search fields are inconsistent:** layers search works, palette works, projects/vars/assets/settings are inert (also C5); widths and paddings vary per instance.
- **L6 — Tour targets can drift** — tour anchors to selectors that hide in Beginner density or when panels are toggled; guard each step.
- **L7 — Minimap has no drag-viewport affordance cursor** and no zoom indication; add grab cursor on viewport rect.
- **L8 — Zoom label click = fit is undiscoverable;** add it to the palette ("Zoom to Fit ⌘0" exists as shortcut only).
- **L9 — `user-select:none` globally** blocks copying values from the Vars table and Runtime log; scope it to chrome, allow selection in data/log surfaces.
- **L10 — Fonts:** Inter is loaded and used as the body font while the stated vocabulary is Rajdhani/Exo 2/JetBrains Mono; decide whether Inter is canon and record it (visual vocabulary doc says Rajdhani + mono).

---

## 7. Quick Wins (≤ half-day each, high perceived value)

1. Deduplicate the six conflicting CSS blocks (H8).
2. Global `:focus-visible` ring + tabindex on the five interactive base classes (H6 pass 1).
3. Wire the trivially wireable dead controls: Runtime Clear/Pause, "Mark all read", table sort, vars search (C5 subset).
4. Empty-selection → Page Properties inspector state (H1 subset).
5. Persist panel visibility, density, zoom/pan, active workspace to `cdk-session` (H4 subset).
6. Scope `lucide.createIcons(root)` calls (M6).
7. Toast "…— ⌘Z to undo" copy reserved until C1 lands; meanwhile add confirm on destructive actions (delete component master, detach).
8. z-index token scale (M5 subset).
9. Allow text selection in Runtime log and Vars values (L9).
10. Clickable breadcrumb segments in the top bar (H4 subset).

---

## 8. Long-Term Improvements

- **ProjectModel + render reconciliation** (C3) — prerequisite for undo, multi-page, real save/load.
- **Full docking engine** (float/dock/auto-hide/pin, saved layouts per workspace) (C4 full).
- **Command registry** driving palette, menus, shortcuts, prefs rebinding (M14 → user-editable keymaps).
- **Shared PanZoomSurface** for canvas + flows + future graph views (H2).
- **Module extraction** of flows model, binding store, component registry into helper files (H5).
- **Accessibility pass 2:** tree/tablist/menu roles, roving tabindex, reduced-motion audit.
- **Live document mirroring:** one board model renders canvas, minimap, Live Mirror, device mocks, Preview (M11).

---

## 9. Prioritized Implementation Roadmap

Sequenced so each phase de-risks the next. Suitable to paste into ROADMAP.md as Phases 23+.

- **Phase 23 — Consistency & Dead-Control Sweep** (C5, H7, H8, M9, L1–L5, L9): dedupe CSS, tokenize radius/heights/z-index, consolidate tabs/segments, wire-or-disable every dead control, semantic cleanup. *Pure polish, zero architectural risk, immediately raises perceived quality.*
- **Phase 24 — Central AppState & Selection Manager** (C2, H4 subset, M2): one store `{workspace, selection, zoom, panels, density, theme}`; convert `sync*` fan-out into subscribers; breadcrumb + status bar become subscribers; session persistence in one key.
- **Phase 25 — Command Registry & Undo/Redo** (C1, M14): command objects with do/undo; ⌘Z/⇧⌘Z; palette/shortcuts/prefs driven from the registry; Timeline panel fed by history.
- **Phase 26 — Contextual Inspector** (H1, M13): sections built per selection type from the component registry; page-properties empty state; beginner stub rows.
- **Phase 27 — Panel System v1** (C4, H9): resizable L/R panels with persisted widths; close/restore for Live Mirror + minimap; snap-to-corner floats; palette commands for every panel.
- **Phase 28 — Flows Graph Parity** (H2, H3): shared pan/zoom surface, marquee + multi-drag, per-port edge anchoring, true/false out-ports, node duplicate.
- **Phase 29 — Data-Driven Workspaces** (H10, M10, M11): Vars table, Projects table, device mocks and Live Mirror all rendered from models; selection flows through AppState.
- **Phase 30 — ProjectModel Migration** (C3, H5): stable ids for widgets/layers/components; registries re-keyed; module extraction (flows model, binding store, component registry).
- **Phase 31 — Accessibility & Input Polish** (H6, M12, M4, M3, L6–L8): focus-visible everywhere, focus-trapped modals, keyboard activation, capability-driven context menus, toast policy.

---

## 10. Code Verification Log (2026-07-07 re-audit)

Exact source evidence gathered by re-reading `CyberDeck IDE (Phase 4).dc.html`. Every Critical/High finding was confirmed still-present; nothing has been fixed since the first pass.

**C1 — Undo/redo absent.** No `undo`/`redo`/command-stack code exists. `history` matches are all cosmetic: `_selHist`+`stepSel()` (2750), Dashboard "Version History" (1061), Timeline overlay (1633), top/status-bar `history` icon (982, 1568). Mutations are direct DOM edits with no inverse (variant delete 2647, override reset 2613).

**C2 — No selection manager.** Manual sync fan-out confirmed: `syncSelBox()` (3178) → `updateMinimap`+`updateMirror`+`updateMinibar`; `syncCompSec()` (2672) → `syncCrumb`+`syncVariants`+`syncOverrides`. `syncSelBox` is hand-called at 1891, 2013, 2814, 2834, 2857, 3093, 3207, 3248, 3277 (+more). `syncCompSec` hand-called at 2379, 2422, 2457, 2464, 2511, 2518, 2524, 2532, 2596, 2601, 2607, 2613, 2628, 2647, 2654, 2661, 2709, 2735 — one missed call per site = silent panel drift.

**C4 — Fixed panels.** `.lpanel{width:252px}` (line 58), `.rpanel{width:290px}` (59) — no resize handles, no persisted width. `.floatp` (Live Mirror) drags but has no close/dock/resize.

**H7 — Seven tab/segment patterns.** `.segc` (122), `.itabs` (129), `.ftabs` (261), `.density`/`.dseg` (359–362), `.bmodes` (396), `.fpseg` (504), `.dtabs` (691). Seven confirmed.

**H8 — Six doubly-defined selectors** (earlier Phase-18/19 block loses to later Phase-13 block):
| Selector | First def | Second def (wins) | Conflict |
|---|---|---|---|
| `.minimap` | 196 (right:14/172w) | 339 (left:14/160×112) | corner + size |
| `.mm-stage` | 205 | 340 | height/cursor |
| `.minibar` | 211 (z12/15px) | 344 (z38/24px) | z-index + icon size |
| `.floatp` | 220 (r14/t14/z9) | 349 (r20/b20/z35) | position + z-index |
| `.canvas.pan` | 193 | 338 | identical (dead dup) |
| `.fnode.run` | 287 | 317 | shadow vs green glow+z6 |

**Density gate** confirmed at line 363: `.app.beginner .pro-only{display:none!important}` — sections vanish with no inspector stub (H1/M13).

*End of audit. Constraint honored: no new features proposed — every item above makes existing behavior cohesive, reversible, consistent, or architecturally sound.*
