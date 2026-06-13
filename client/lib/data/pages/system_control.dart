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

/// The System Control page layout (24x16 grid).
LayoutPage systemControlPage() {
  final widgets = <WidgetNode>[
    // ───────────────────────── Page title ─────────────────────────
    label(
      'sc.title',
      placement: at(0, 0, colSpan: 12, rowSpan: 1),
      text: 'SYSTEM CONTROL',
      font: 'display',
      color: _cyan,
    ),
    label(
      'sc.subtitle',
      placement: at(0, 1, colSpan: 12, rowSpan: 1),
      text: 'Manage your system, performance and utilities',
      font: 'body',
    ),

    // ════════════════════════ SYSTEM CONTROL (power actions) ════════════════
    panel(
      'sc.power.panel',
      placement: at(0, 2, colSpan: 8, rowSpan: 8),
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
      placement: at(8, 2, colSpan: 8, rowSpan: 8),
      title: 'Performance Modes',
      accent: _purple,
    ),
    label(
      'sc.perf.hint',
      placement: at(9, 2, colSpan: 6, rowSpan: 1),
      text: 'Optimize your system performance',
      font: 'body',
    ),
    // Silent.
    label(
      'sc.perf.silent.name',
      placement: at(9, 3, colSpan: 4, rowSpan: 1),
      text: 'Silent Mode',
      font: 'heading',
      color: _cyan,
    ),
    label(
      'sc.perf.silent.desc',
      placement: at(9, 4, colSpan: 4, rowSpan: 1),
      text: 'Low power, minimal fan noise',
      font: 'body',
    ),
    controlTile(
      'sc.perf.silent.activate',
      label: 'Activate',
      icon: 'check',
      action: 'performance.setMode.silent',
      placement: at(14, 3, colSpan: 1, rowSpan: 1),
      color: _cyan,
    ),
    // Balanced (active by default).
    label(
      'sc.perf.balanced.name',
      placement: at(9, 5, colSpan: 4, rowSpan: 1),
      text: 'Balanced Mode',
      font: 'heading',
      color: _ok,
    ),
    label(
      'sc.perf.balanced.desc',
      placement: at(9, 6, colSpan: 4, rowSpan: 1),
      text: 'Optimal performance and efficiency',
      font: 'body',
    ),
    controlTile(
      'sc.perf.balanced.activate',
      label: 'Active',
      icon: 'check',
      action: 'performance.setMode.balanced',
      placement: at(14, 5, colSpan: 1, rowSpan: 1),
      color: _ok,
    ),
    // Performance.
    label(
      'sc.perf.high.name',
      placement: at(9, 7, colSpan: 4, rowSpan: 1),
      text: 'Performance Mode',
      font: 'heading',
      color: _warn,
    ),
    label(
      'sc.perf.high.desc',
      placement: at(9, 8, colSpan: 4, rowSpan: 1),
      text: 'Higher performance, more power',
      font: 'body',
    ),
    controlTile(
      'sc.perf.high.activate',
      label: 'Activate',
      icon: 'bolt',
      action: 'performance.setMode.performance',
      placement: at(14, 7, colSpan: 1, rowSpan: 1),
      color: _warn,
    ),
    // Turbo.
    label(
      'sc.perf.turbo.name',
      placement: at(9, 9, colSpan: 4, rowSpan: 1),
      text: 'Turbo Mode',
      font: 'heading',
      color: _err,
    ),
    label(
      'sc.perf.turbo.desc',
      placement: at(9, 10, colSpan: 4, rowSpan: 1),
      text: 'Maximum performance, max power draw',
      font: 'body',
    ),
    controlTile(
      'sc.perf.turbo.activate',
      label: 'Activate',
      icon: 'bolt',
      action: 'performance.setMode.turbo',
      placement: at(14, 9, colSpan: 1, rowSpan: 1),
      color: _err,
      confirm: true,
    ),

    // ════════════════════════ QUICK SHORTCUTS ══════════════════════════════
    statusList(
      'sc.shortcuts',
      placement: at(16, 2, colSpan: 8, rowSpan: 5),
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
      placement: at(16, 7, colSpan: 8, rowSpan: 6),
      title: 'Networks',
      accent: _cyan,
    ),
    // Download.
    statRow(
      'sc.net.down.label',
      label: 'Download',
      placement: at(17, 8, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.download',
      unit: ' Mbps',
      color: _cyan,
    ),
    sparkline(
      'sc.net.down.spark',
      placement: at(20, 8, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.download.series',
      color: _cyan,
      capacity: 48,
    ),
    // Upload.
    statRow(
      'sc.net.up.label',
      label: 'Upload',
      placement: at(17, 9, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.upload',
      unit: ' Mbps',
      color: _purple,
    ),
    sparkline(
      'sc.net.up.spark',
      placement: at(20, 9, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.upload.series',
      color: _purple,
      capacity: 48,
    ),
    // Ping.
    statRow(
      'sc.net.ping.label',
      label: 'Ping',
      placement: at(17, 10, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.ping',
      unit: ' ms',
      color: _ok,
    ),
    sparkline(
      'sc.net.ping.spark',
      placement: at(20, 10, colSpan: 3, rowSpan: 1),
      stateBinding: 'net.ping.series',
      color: _ok,
      capacity: 48,
    ),

    // ════════════════════════ STORAGE DRIVES ═══════════════════════════════
    panel(
      'sc.storage.panel',
      placement: at(0, 10, colSpan: 8, rowSpan: 6),
      title: 'Storage Drives',
      accent: _cyan,
    ),
    gaugeLinear(
      'sc.storage.c',
      placement: at(1, 11, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.c.percent',
      label: 'C: System (SSD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.d',
      placement: at(1, 12, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.d.percent',
      label: 'D: Games (SSD)',
      unit: '%',
      color: _purple,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.e',
      placement: at(1, 13, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.e.percent',
      label: 'E: Media (HDD)',
      unit: '%',
      color: _cyan,
      valueRules: _heatRules,
    ),
    gaugeLinear(
      'sc.storage.f',
      placement: at(1, 14, colSpan: 6, rowSpan: 1),
      stateBinding: 'storage.f.percent',
      label: 'F: Backup (HDD)',
      unit: '%',
      color: _warn,
      valueRules: _heatRules,
    ),

    // ════════════════════════ SYSTEM INFORMATION ═══════════════════════════
    panel(
      'sc.sysinfo.panel',
      placement: at(8, 10, colSpan: 5, rowSpan: 6),
      title: 'System Information',
      accent: _purple,
    ),
    statRow(
      'sc.sysinfo.os',
      label: 'Operating System',
      value: 'Windows 11 Pro',
      placement: at(9, 11, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.cpu',
      label: 'Processor',
      value: 'Intel Core i9-13900K',
      placement: at(9, 12, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.mobo',
      label: 'Motherboard',
      value: 'ROG Z790 Hero',
      placement: at(9, 13, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.gpu',
      label: 'GPU',
      value: 'RTX 4090',
      placement: at(9, 14, colSpan: 3, rowSpan: 1),
    ),
    statRow(
      'sc.sysinfo.cputemp',
      label: 'CPU Temp',
      placement: at(9, 15, colSpan: 3, rowSpan: 1),
      stateBinding: 'sys.cpu.temp',
      unit: '°C',
      valueRules: _heatRules,
      color: _ok,
    ),

    // ════════════════════════ FAN CONTROL ══════════════════════════════════
    panel(
      'sc.fan.panel',
      placement: at(13, 10, colSpan: 3, rowSpan: 6),
      title: 'Fan Control',
      accent: _cyan,
    ),
    label(
      'sc.fan.cpu.label',
      placement: at(13, 11, colSpan: 3, rowSpan: 1),
      text: 'CPU Fan',
      font: 'body',
    ),
    slider(
      'sc.fan.cpu',
      placement: at(13, 12, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.cpu.percent',
      action: 'fan.setSpeed.cpu',
      color: _cyan,
    ),
    label(
      'sc.fan.case1.label',
      placement: at(13, 13, colSpan: 3, rowSpan: 1),
      text: 'Case Fan 1',
      font: 'body',
    ),
    slider(
      'sc.fan.case1',
      placement: at(13, 14, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.case1.percent',
      action: 'fan.setSpeed.case1',
      color: _purple,
    ),
    toggle(
      'sc.fan.auto',
      placement: at(13, 15, colSpan: 3, rowSpan: 1),
      stateBinding: 'fan.auto',
      label: 'Auto Fan Control',
      action: 'fan.toggleAuto',
      color: _ok,
    ),

    // ════════════════════════ SYSTEM UPTIME ════════════════════════════════
    panel(
      'sc.uptime.panel',
      placement: at(16, 13, colSpan: 8, rowSpan: 3),
      title: 'System Uptime',
      accent: _purple,
      glow: false,
    ),
    iconButton(
      'sc.uptime.icon',
      icon: 'clock',
      placement: at(17, 14, colSpan: 1, rowSpan: 1),
      color: _purple,
    ),
    label(
      'sc.uptime.value',
      placement: at(18, 14, colSpan: 5, rowSpan: 1),
      stateBinding: 'sys.uptime',
      font: 'mono',
      color: _cyan,
    ),
  ];

  return LayoutPage(
    id: 'system-control',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}
