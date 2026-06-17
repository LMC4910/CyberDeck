/// System Control page (Wave B) — the "command center" control surface from the
/// reference deck: power actions, performance modes, storage health, system
/// information, fan control, networks and uptime.
///
/// Authored under the COMPOSITE-CARD MODEL (one widget = one entity): every
/// visual CARD is a SINGLE composite node that draws its OWN card chrome plus all
/// of its sub-content, so the Designer treats each card as one editable entity:
///
///   * the storage drives → four `gauge.linear` CARDS (titled bar in one node);
///   * the system-information card → a `list.card`;
///   * the quick-shortcuts list → a `list.card`;
///   * the networks readout → a `list.card`;
///   * each performance mode → a `mode.card` (icon + name + desc + ACTIVATE);
///   * the system-uptime card → a `list.card` readout.
///
/// INDIVIDUAL CONTROLS stay one node each (they are already single entities):
/// the power-action grid is a set of `control.tile`s, and the fan controls are
/// `slider`/`toggle`s — these are framed by a section [panel] (their only use of
/// a panel: a frame around standalone controls, never a decomposed card).
///
/// All widgets are data-driven (style/config + bound state ids); no palette
/// literals — colours come from theme tokens via the shared node builders. The
/// mock state ids bound here (for Wave 2 to seed) are listed in the agent report.
library;

import '../../render/model.dart';
import 'builders.dart';

/// Tints for value thresholds reused across the page (mirrors DeckStatus tokens).
const _ok = '#00E676';
const _warn = '#FFAB40';
const _err = '#FF5252';
const _cyan = '#00B4D8';
const _purple = '#7B2FBE';

/// Heat colouring for temperature/usage gauges (green < warm < hot).
const List<Map<String, dynamic>> _heatRules = [
  {
    'when': '>=85',
    'style': {'color': _err}
  },
  {
    'when': '>=70',
    'style': {'color': _warn}
  },
];

/// The System Control page layout (24×18 grid). A power-action grid + the four
/// performance MODE CARDS fill the top band; a Quick-Shortcuts + Networks list
/// runs down the right column; Storage / System Info / Fan / Uptime form the
/// bottom band. Every CARD is a single composite node; only the power grid and
/// the fan controls — pure individual controls — sit on a framing panel.
LayoutPage systemControlPage() {
  final widgets = <WidgetNode>[
    // ───────────────────────── Page title ─────────────────────────
    sectionHeader(
      'sc.title',
      placement: at(0, 0, colSpan: 12, rowSpan: 1),
      title: 'System Control',
      color: _cyan,
    ),
    sectionHeader(
      'sc.subtitle',
      placement: at(0, 1, colSpan: 12, rowSpan: 1),
      title: 'Manage your system, performance and utilities',
    ),

    // ════════════ SYSTEM CONTROL (power actions — individual tiles) ══════════
    // A framing panel around STANDALONE control tiles (each tile is its own
    // editable entity — NOT a decomposed card). 3 rows × 4 power actions.
    panel(
      'sc.power.panel',
      placement: at(0, 2, colSpan: 9, rowSpan: 9),
      title: 'System Control',
      accent: _cyan,
    ),
    // Row 1 — restart / shut down / sleep / hibernate.
    controlTile(
      'sc.power.restart',
      label: 'Restart PC',
      icon: 'power',
      action: 'system.restart',
      placement: at(1, 3, colSpan: 2, rowSpan: 2),
      color: _cyan,
      confirm: true,
    ),
    controlTile(
      'sc.power.shutdown',
      label: 'Shut Down',
      icon: 'power',
      action: 'system.shutdown',
      placement: at(3, 3, colSpan: 2, rowSpan: 2),
      color: _err,
      confirm: true,
    ),
    controlTile(
      'sc.power.sleep',
      label: 'Sleep',
      icon: 'clock',
      action: 'system.sleep',
      placement: at(5, 3, colSpan: 2, rowSpan: 2),
      color: _purple,
    ),
    controlTile(
      'sc.power.hibernate',
      label: 'Hibernate',
      icon: 'battery',
      action: 'system.hibernate',
      placement: at(7, 3, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),
    // Row 2 — lock / log off / kill process / task manager.
    controlTile(
      'sc.power.lock',
      label: 'Lock PC',
      icon: 'settings',
      action: 'system.lock',
      placement: at(1, 5, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),
    controlTile(
      'sc.power.logoff',
      label: 'Log Off',
      icon: 'power',
      action: 'system.logoff',
      placement: at(3, 5, colSpan: 2, rowSpan: 2),
      color: _warn,
      confirm: true,
    ),
    controlTile(
      'sc.power.kill',
      label: 'Kill Process',
      icon: 'alert',
      action: 'system.killProcess',
      placement: at(5, 5, colSpan: 2, rowSpan: 2),
      color: _err,
    ),
    controlTile(
      'sc.power.taskmgr',
      label: 'Task Manager',
      icon: 'cpu',
      action: 'launch.app',
      param: 'taskmgr.exe',
      placement: at(7, 5, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),
    // Row 3 — clear cache / disk cleanup / empty recycle / system info.
    controlTile(
      'sc.power.clearcache',
      label: 'Clear Cache',
      icon: 'storage',
      action: 'system.clearCache',
      placement: at(1, 7, colSpan: 2, rowSpan: 2),
      color: _purple,
    ),
    controlTile(
      'sc.power.diskcleanup',
      label: 'Disk Cleanup',
      icon: 'disk',
      action: 'launch.app',
      param: 'cleanmgr.exe',
      placement: at(3, 7, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),
    controlTile(
      'sc.power.recycle',
      label: 'Empty Recycle Bin',
      icon: 'storage',
      action: 'system.emptyRecycleBin',
      placement: at(5, 7, colSpan: 2, rowSpan: 2),
      color: _warn,
      confirm: true,
    ),
    controlTile(
      'sc.power.sysinfo',
      label: 'System Info',
      icon: 'info',
      action: 'launch.app',
      param: 'msinfo32.exe',
      placement: at(7, 7, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),

    // ════════════════ PERFORMANCE MODES (four mode CARDS) ═══════════════════
    // Each mode is ONE composite mode.card (icon + name + description + an
    // ACTIVATE/ACTIVE button reflecting its bound boolean) — no panel, no
    // decomposed header/desc/tile parts.
    modeCard(
      'sc.perf.silent',
      placement: at(9, 2, colSpan: 4, rowSpan: 4),
      name: 'Silent Mode',
      description: 'Reduces fan speed and power usage',
      icon: 'fan',
      stateBinding: 'performance.mode.silent',
      action: 'performance.setMode.silent',
      color: _cyan,
    ),
    modeCard(
      'sc.perf.balanced',
      placement: at(13, 2, colSpan: 3, rowSpan: 4),
      name: 'Balanced Mode',
      description: 'Balanced performance and efficiency',
      icon: 'check',
      stateBinding: 'performance.mode.balanced',
      action: 'performance.setMode.balanced',
      color: _ok,
    ),
    modeCard(
      'sc.perf.high',
      placement: at(9, 6, colSpan: 4, rowSpan: 4),
      name: 'Performance Mode',
      description: 'Higher performance and fan speed',
      icon: 'bolt',
      stateBinding: 'performance.mode.performance',
      action: 'performance.setMode.performance',
      color: _warn,
    ),
    modeCard(
      'sc.perf.turbo',
      placement: at(13, 6, colSpan: 3, rowSpan: 4),
      name: 'Turbo Mode',
      description: 'Maximum performance (all cores)',
      icon: 'bolt',
      stateBinding: 'performance.mode.turbo',
      action: 'performance.setMode.turbo',
      color: _err,
    ),

    // ════════════════════════ QUICK SHORTCUTS (one card) ════════════════════
    listCard(
      'sc.shortcuts',
      placement: at(16, 2, colSpan: 8, rowSpan: 6),
      title: 'Quick Shortcuts',
      color: _purple,
      items: const [
        {'leading': 'settings', 'label': 'Control Panel', 'trailing': 'launch'},
        {'leading': 'cpu', 'label': 'Device Manager', 'trailing': 'launch'},
        {'leading': 'download', 'label': 'Windows Update', 'trailing': 'launch'},
        {'leading': 'settings', 'label': 'Services', 'trailing': 'launch'},
        {'leading': 'app', 'label': 'Startup Apps', 'trailing': 'launch'},
        {'leading': 'storage', 'label': 'Programs & Features', 'trailing': 'launch'},
        {'leading': 'folder', 'label': 'Registry Editor', 'trailing': 'launch'},
        {'leading': 'info', 'label': 'Event Viewer', 'trailing': 'launch'},
      ],
    ),

    // ════════════════════════ NETWORKS (one card) ══════════════════════════
    // The down/up/ping readout collapses from a panel + stat rows + sparklines
    // into ONE list.card; each row is icon + label + live value.
    listCard(
      'sc.net',
      placement: at(16, 8, colSpan: 8, rowSpan: 6),
      title: 'Networks',
      color: _cyan,
      items: const [
        {
          'leading': 'download',
          'label': 'Download',
          'value': '125.6 Mbps',
          'color': _cyan,
        },
        {
          'leading': 'upload',
          'label': 'Upload',
          'value': '23.4 Mbps',
          'color': _purple,
        },
        {
          'leading': 'wifi',
          'label': 'Ping',
          'value': '8 ms',
          'color': _ok,
        },
        {
          'leading': 'network',
          'label': 'Status',
          'value': 'Connected',
          'color': _ok,
        },
      ],
    ),

    // ════════════════════════ STORAGE DRIVES (four CARDS) ═══════════════════
    // Each drive is ONE composite gauge.linear card (titled bar + value in a
    // single node) — no shared panel, no decomposed bar+label parts.
    gaugeLinear(
      'sc.storage.c',
      placement: at(0, 11, colSpan: 4, rowSpan: 3),
      stateBinding: 'storage.c.percent',
      card: true,
      title: 'C: System (SSD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.d',
      placement: at(4, 11, colSpan: 4, rowSpan: 3),
      stateBinding: 'storage.d.percent',
      card: true,
      title: 'D: Games (SSD)',
      unit: '%',
      color: _purple,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.e',
      placement: at(0, 14, colSpan: 4, rowSpan: 3),
      stateBinding: 'storage.e.percent',
      card: true,
      title: 'E: Media (HDD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.f',
      placement: at(4, 14, colSpan: 4, rowSpan: 3),
      stateBinding: 'storage.f.percent',
      card: true,
      title: 'F: Backup (HDD)',
      unit: '%',
      color: _warn,
      valueRules: _heatRules,
    ),

    // ════════════════════════ SYSTEM INFORMATION (one card) ═════════════════
    // The spec list collapses from a panel + stat rows into ONE list.card.
    // Binds the live `sys.info` map (os/cpu real); rows without a `field`
    // (Motherboard / GPU / CPU Temp) keep their authored literal.
    listCard(
      'sc.sysinfo',
      placement: at(8, 11, colSpan: 5, rowSpan: 6),
      title: 'System Information',
      color: _purple,
      stateBinding: 'sys.info',
      items: const [
        {'label': 'Operating System', 'field': 'os', 'value': 'Windows 11 Pro'},
        {'label': 'Processor', 'field': 'cpu', 'value': 'Core i9-13900K'},
        {'label': 'Motherboard', 'value': 'ROG Z790 Hero'},
        {'label': 'GPU', 'value': 'RTX 4090'},
        {'label': 'CPU Temp', 'value': '42°C', 'color': _ok},
      ],
    ),

    // ════════════ FAN CONTROL (individual sliders + a toggle) ════════════════
    // A framing panel around STANDALONE controls (each slider/toggle is its own
    // editable entity — NOT a decomposed card).
    panel(
      'sc.fan.panel',
      placement: at(13, 11, colSpan: 3, rowSpan: 6),
      title: 'Fan Control',
      accent: _cyan,
    ),
    sectionHeader(
      'sc.fan.cpu.label',
      placement: at(13, 12, colSpan: 3, rowSpan: 1),
      title: 'CPU Fan',
    ),
    slider(
      'sc.fan.cpu',
      placement: at(13, 13, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.cpu.percent',
      action: 'fan.setSpeed.cpu',
      color: _cyan,
    ),
    sectionHeader(
      'sc.fan.case1.label',
      placement: at(13, 14, colSpan: 3, rowSpan: 1),
      title: 'Case Fan 1',
    ),
    slider(
      'sc.fan.case1',
      placement: at(13, 15, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.case1.percent',
      action: 'fan.setSpeed.case1',
      color: _purple,
    ),
    toggle(
      'sc.fan.auto',
      placement: at(13, 16, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.auto',
      label: 'Auto Fan Control',
      action: 'fan.toggleAuto',
      color: _ok,
    ),

    // ════════════════════════ SYSTEM UPTIME (one card) ══════════════════════
    // The uptime readout collapses from a panel + icon + label into ONE
    // list.card row (live value bound via the row's value/stateKey is seeded by
    // the host; here a representative readout keeps the card cohesive).
    listCard(
      'sc.uptime',
      placement: at(16, 14, colSpan: 8, rowSpan: 4),
      title: 'System Uptime',
      color: _purple,
      items: const [
        {'leading': 'clock', 'label': 'Uptime', 'value': '2d 14h 36m', 'color': _cyan},
        {'leading': 'power', 'label': 'Last Boot', 'value': 'Today, 06:14', 'color': _purple},
      ],
    ),
  ];

  return LayoutPage(
    id: 'system-control',
    grid: const GridConfig(columns: 24, rows: 18),
    widgets: widgets,
  );
}
