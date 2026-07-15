# CyberDeck Designer — Feature Inventory
Full map of every mode/tab in the `CyberDeck Designer.dc.html` mockup, for implementation planning.

## Global chrome
- **Top bar**: brand, workspace switcher ("Battlestation"), breadcrumb (Profile › Page), global search (⌘K command palette), collaborator avatars, history, notifications, Share, window controls.
- **Left rail (mode switcher)**: Design · Flows · Library · Vars · Runtime · Preview, plus command-palette and settings buttons.
- **Command palette (⌘K)**: navigate to modes, insert widgets (gauge/button/slider), actions (present on devices, bind selection to live state, duplicate selection), keyboard shortcut hints, fuzzy filter.
- **Density toggle**: Beginner vs Power mode — hides pro-only controls (align tools, opacity, border, elevation, bindings/states/events sections) and shows beginner hints.

---

## 1. Design mode
### Left panel — 3 tabs
**Project tab** (workspace explorer, collapsible sections):
- Pages (Live Game Stats, Home, Dashboard)
- Components (Cards, Buttons, RGB Widgets)
- Variables (Global, Runtime, Expressions)
- Assets (Images, Icons, Fonts, Audio)
- Themes (Default/Streaming/Gaming, active indicator)
- Plugins (GitHub, Discord, OBS, MQTT, Spotify — with connection status dots)
- Devices (Desktop, Phone, Tablet — status)
- Workflows (Startup, Gaming, Productivity)
- Scripts (Python, JavaScript)
- AI (Prompt Library, Automation Generator)
- Deployments (Windows, Android, macOS — version tags)
- Header actions: new folder, new file, collapse all

**Layers tab**:
- Device/artboard row ("Living Room iPad")
- Layer search, expand/collapse all
- Filter chips: All / Containers / Visible / Locked
- Breadcrumb of current nesting
- Layer tree: rename (double-click contenteditable), visibility, lock, color dot, drag-reorder, container nesting

**Components tab**:
- Search + category chips (All/Layout/Controls/Data/Media)
- Drag-to-canvas grid: Frame, Stack, Grid, Tabs, Button, Gauge, Slider, Toggle, Stat, Media Card, Label, Image Tile, Chart, Knob

### Canvas
- Tools: Move, Hand, Frame, Text, Comment
- Align/distribute tools (pro)
- Device pill (iPad · 10×6 · landscape)
- Zoom controls (in/out, % readout, click-to-fit), Present button
- Pan/zoom world, dotted background, artboard with tag + dimensions
- Selection: single/multi (marquee), handles, dimension readout, smart guides (V/H), snapping
- Mini action bar on selection: duplicate, lock, group, delete, more
- Floating "Live Mirror" panel (draggable, synced device thumbnail + latency)
- Minimap (viewport navigation)
- Status bar: engine connection, live device count, cursor x/y, grid+snap state, save state, "Reflecting live"

### Right panel — Inspector (3 states)
- **One selected**: type header, Layout (X/Y/W/H, opacity), Container Layout (col/row/grid direction, cols/rows, gap/pad, justify, align), Appearance (fill, radius, border, solid/glass/none, elevation), plus JS-built sections:
  - **Bindings** — bind any property to a variable (static/variable/expression modes, direction, favorites/recents, categories, conditional color rules)
  - **States** — state chips, custom states, per-state property overrides
  - **Events** — event rows opening a flow drawer (attach/edit flow per event, test, "open in Flows")
- **Multi selected**: align 6-way, distribute H/V, group
- **None selected**: artboard props (grid cols/rows/gutter/pad, background)

---

## 2. Flows mode (automation builder)
- **Left**: searchable node library, 6 categories:
  - Triggers: State Change, Schedule, MQTT Message, GitHub Event, OBS Event
  - Logic: Condition, Set Variable, Loop, Expression, Function, Delay
  - Data: Math, Text, Date Time, Array, Object
  - Integrations: HTTP Request, MQTT Publish, GitHub, OBS, Discord, Spotify, Clipboard
  - Actions: Set Profile, Notify, Lighting, Go To Page
  - Structure: Subflow, Comment, Reroute
- **Center**: flow tabs (multiple flows, + new flow), node canvas (drag nodes, connect edges with arrowheads, animated running edges), toolbar: Test run, Armed toggle
- **Right**: node inspector (per-node-kind fields)

## 3. Library mode
- Left: category list (All, Favorites, Recently Used, Controls, Live Data, Media, Layout, Plugin Components, My Components) + search
- Main: component gallery with filter chips, categorized cards:
  - Controls: Button, Toggle, Slider, Knob, Joystick
  - Live Data: Gauge, Sparkline, Chart, Stat, Progress Ring
  - Media & Layout: Media Card, Image Tile, Lottie, Label, Container

## 4. Vars mode (variables manager)
- Left: scope categories — All, Global, Page, Runtime, Computed, Expression, Environment, Plugin, System
- Toolbar: search, New Variable, Import/Export, Filter, Group, Columns, dependency Graph toggle, Live toggle, Refresh
- Table: checkbox multi-select (click/⌘/shift), sortable columns, inline edit (dbl-click), context menu, status (ok/warn/err), refs ("used by" page/component/flow/plugin — click navigates), types: string, number, boolean, color, image, json, array, object, date, time, enum, plugin, custom; computed & expression vars; masked secrets
- Right: variable inspector (details, history, references)
- Footer: counts, live status

## 5. Runtime mode (observability)
- Left: Running Flows (running/armed/off badges), Execution Queue, Timers
- Center: execution log (timestamp, level INFO/WARN/ERR/OK, source, message; monospace), toolbar: Live toggle, Step, Clear; footer with entry count + events/min
- Right: Performance panel (CPU/GPU/FPS/avg exec/memory with heat bars), Plugin statuses, Device statuses

## 6. Preview mode
- Toolbar: device selector (Phone/Tablet), Rotate, Resync, Runtime toggle
- Live device mockups (Pixel 8 portrait, iPad landscape) rendering the deck with live tiles (launch, FPS ring, CPU, temp, toggles, media, volume) + latency badges
