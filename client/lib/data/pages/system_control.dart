/// System Control page (Wave 1) — the "command center" control surface from the
/// reference deck: power actions, performance modes, storage health, system
/// information, fan control, networks and uptime.
///
/// Authored under the GRANULARITY MODEL: every visual "card" is a glass [panel]
/// placed FIRST (so the interpreter paints it BEHIND, list-order Stack layering),
/// then small BARE widgets (control tiles, stat rows, gauges, sliders,
/// sparklines, labels) are layered ON TOP — each individually Designer-editable.
///
/// All widgets are data-driven (style/config + bound state ids); no palette
/// literals — colours come from theme tokens via the shared node builders.
///
/// Mock state ids bound here (for Wave 2 to seed) are listed in the agent report.
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

/// The System Control page layout (24x18 grid). Two tall top panels (System
/// Control + Performance Modes) over a bottom band (Storage / System Info / Fan /
/// Networks / Uptime); a Quick Shortcuts list runs down the right column.
LayoutPage systemControlPage() {
  final widgets = <WidgetNode>[
    // ───────────────────────── Page title ─────────────────────────
    // Static captions use section.header so they render the literal text (a
    // bound `label` would append a "-- " value placeholder when unbound).
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

    // ════════════════════════ SYSTEM CONTROL (power actions) ════════════════
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
      action: 'system.taskManager',
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
      action: 'system.diskCleanup',
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
      action: 'system.openInfo',
      placement: at(7, 7, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),

    // ════════════════════════ PERFORMANCE MODES ════════════════════════════
    panel(
      'sc.perf.panel',
      placement: at(9, 2, colSpan: 7, rowSpan: 9),
      title: 'Performance Modes',
      accent: _purple,
    ),
    // Four modes, each a NAME header above a muted DESCRIPTION, with its
    // Activate/Active tile aligned right. Each mode occupies a 2-row block so the
    // two text lines breathe; the cluster fills rows 3–10 inside the panel.
    // section.header renders literal text (a bound `label` would append "-- ").
    // Silent.
    sectionHeader(
      'sc.perf.silent.name',
      placement: at(10, 3, colSpan: 4, rowSpan: 1),
      title: 'Silent Mode',
      color: _cyan,
    ),
    sectionHeader(
      'sc.perf.silent.desc',
      placement: at(10, 4, colSpan: 4, rowSpan: 1),
      title: 'Reduces fan speed and power usage',
    ),
    controlTile(
      'sc.perf.silent.activate',
      label: 'Activate',
      icon: 'check',
      action: 'performance.setMode.silent',
      placement: at(14, 3, colSpan: 2, rowSpan: 2),
      color: _cyan,
    ),
    // Balanced (active by default).
    sectionHeader(
      'sc.perf.balanced.name',
      placement: at(10, 5, colSpan: 4, rowSpan: 1),
      title: 'Balanced Mode',
      color: _ok,
    ),
    sectionHeader(
      'sc.perf.balanced.desc',
      placement: at(10, 6, colSpan: 4, rowSpan: 1),
      title: 'Balanced performance and efficiency',
    ),
    controlTile(
      'sc.perf.balanced.activate',
      label: 'Active',
      icon: 'check',
      action: 'performance.setMode.balanced',
      placement: at(14, 5, colSpan: 2, rowSpan: 2),
      color: _ok,
    ),
    // Performance.
    sectionHeader(
      'sc.perf.high.name',
      placement: at(10, 7, colSpan: 4, rowSpan: 1),
      title: 'Performance Mode',
      color: _warn,
    ),
    sectionHeader(
      'sc.perf.high.desc',
      placement: at(10, 8, colSpan: 4, rowSpan: 1),
      title: 'Higher performance and fan speed',
    ),
    controlTile(
      'sc.perf.high.activate',
      label: 'Activate',
      icon: 'bolt',
      action: 'performance.setMode.performance',
      placement: at(14, 7, colSpan: 2, rowSpan: 2),
      color: _warn,
    ),
    // Turbo.
    sectionHeader(
      'sc.perf.turbo.name',
      placement: at(10, 9, colSpan: 4, rowSpan: 1),
      title: 'Turbo Mode',
      color: _err,
    ),
    sectionHeader(
      'sc.perf.turbo.desc',
      placement: at(10, 10, colSpan: 4, rowSpan: 1),
      title: 'Maximum performance (all cores)',
    ),
    controlTile(
      'sc.perf.turbo.activate',
      label: 'Activate',
      icon: 'bolt',
      action: 'performance.setMode.turbo',
      placement: at(14, 9, colSpan: 2, rowSpan: 2),
      color: _err,
      confirm: true,
    ),

    // ════════════════════════ QUICK SHORTCUTS ══════════════════════════════
    statusList(
      'sc.shortcuts',
      placement: at(16, 2, colSpan: 8, rowSpan: 6),
      title: 'Quick Shortcuts',
      color: _purple,
      items: const [
        {'label': 'Control Panel', 'value': '>', 'icon': 'settings'},
        {'label': 'Device Manager', 'value': '>', 'icon': 'cpu'},
        {'label': 'Windows Update', 'value': '>', 'icon': 'download'},
        {'label': 'Services', 'value': '>', 'icon': 'settings'},
        {'label': 'Startup Apps', 'value': '>', 'icon': 'app'},
        {'label': 'Programs & Features', 'value': '>', 'icon': 'storage'},
        {'label': 'Registry Editor', 'value': '>', 'icon': 'folder'},
        {'label': 'Event Viewer', 'value': '>', 'icon': 'info'},
      ],
    ),

    // ════════════════════════ NETWORKS ═════════════════════════════════════
    panel(
      'sc.net.panel',
      placement: at(16, 8, colSpan: 8, rowSpan: 6),
      title: 'Networks',
      accent: _cyan,
    ),
    // Download.
    statRow(
      'sc.net.down.label',
      label: 'Download',
      placement: at(17, 9, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.download',
      unit: ' Mbps',
      color: _cyan,
    ),
    sparkline(
      'sc.net.down.spark',
      placement: at(20, 9, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.download.series',
      color: _cyan,
      capacity: 48,
    ),
    // Upload.
    statRow(
      'sc.net.up.label',
      label: 'Upload',
      placement: at(17, 11, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.upload',
      unit: ' Mbps',
      color: _purple,
    ),
    sparkline(
      'sc.net.up.spark',
      placement: at(20, 11, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.upload.series',
      color: _purple,
      capacity: 48,
    ),
    // Ping.
    statRow(
      'sc.net.ping.label',
      label: 'Ping',
      placement: at(17, 12, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.ping',
      unit: ' ms',
      color: _ok,
    ),
    sparkline(
      'sc.net.ping.spark',
      placement: at(20, 12, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.ping.series',
      color: _ok,
      capacity: 48,
    ),

    // ════════════════════════ STORAGE DRIVES ═══════════════════════════════
    panel(
      'sc.storage.panel',
      placement: at(0, 11, colSpan: 8, rowSpan: 7),
      title: 'Storage Drives',
      accent: _cyan,
    ),
    gaugeLinear(
      'sc.storage.c',
      placement: at(1, 12, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.c.percent',
      label: 'C: System (SSD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.d',
      placement: at(1, 13, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.d.percent',
      label: 'D: Games (SSD)',
      unit: '%',
      color: _purple,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.e',
      placement: at(1, 14, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.e.percent',
      label: 'E: Media (HDD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.f',
      placement: at(1, 15, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.f.percent',
      label: 'F: Backup (HDD)',
      unit: '%',
      color: _warn,
      valueRules: _heatRules,
    ),

    // ════════════════════════ SYSTEM INFORMATION ═══════════════════════════
    panel(
      'sc.sysinfo.panel',
      placement: at(8, 11, colSpan: 5, rowSpan: 7),
      title: 'System Information',
      accent: _purple,
    ),
    statRow(
      'sc.sysinfo.os',
      label: 'Operating System',
      value: 'Windows 11 Pro',
      placement: at(9, 12, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.cpu',
      label: 'Processor',
      value: 'Intel Core i9-13900K',
      placement: at(9, 13, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.mobo',
      label: 'Motherboard',
      value: 'ROG Z790 Hero',
      placement: at(9, 14, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.gpu',
      label: 'GPU',
      value: 'RTX 4090',
      placement: at(9, 15, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.cputemp',
      label: 'CPU Temp',
      placement: at(9, 16, colSpan: 3, rowSpan: 1),
      stateBinding: 'sys.cpu.temp',
      unit: '°C',
      valueRules: _heatRules,
      color: _ok,
    ),

    // ════════════════════════ FAN CONTROL ══════════════════════════════════
    panel(
      'sc.fan.panel',
      placement: at(13, 11, colSpan: 3, rowSpan: 7),
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

    // ════════════════════════ SYSTEM UPTIME ════════════════════════════════
    panel(
      'sc.uptime.panel',
      placement: at(16, 14, colSpan: 8, rowSpan: 4),
      title: 'System Uptime',
      accent: _purple,
      glow: false,
    ),
    // A square clock chip (control.tile renders the deck-icon set, which includes
    // 'clock'; the round `button` widget's icon map does not) beside the live
    // uptime readout.
    controlTile(
      'sc.uptime.icon',
      label: '',
      icon: 'clock',
      action: 'system.openUptime',
      placement: at(17, 15, colSpan: 2, rowSpan: 2),
      color: _purple,
    ),
    label(
      'sc.uptime.value',
      placement: at(19, 15, colSpan: 4, rowSpan: 2),
      stateBinding: 'sys.uptime',
      font: 'mono',
      color: _cyan,
    ),
  ];

  return LayoutPage(
    id: 'system-control',
    grid: const GridConfig(columns: 24, rows: 18),
    widgets: widgets,
  );
}
