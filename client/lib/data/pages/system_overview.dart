/// System Overview page (Wave 1) — the deck's at-a-glance telemetry dashboard,
/// authored under the GRANULARITY MODEL: every "card" is a glass [panel] placed
/// FIRST (so the interpreter paints it BEHIND, per list-order Stack layering),
/// then small BARE widgets (metric tiles, stat rows, a performance sparkline,
/// gauge rings, a storage donut + legend, process rows, alert items) are layered
/// ON TOP — each individually editable by the Designer.
///
/// Composed on a 24×16 grid mirroring the reference render: a row of metric tiles
/// up top; System Performance / Detailed System Info / System Health in the
/// middle band; Storage Overview / Top Processes / System Alerts along the
/// bottom band. All values bind to realistic mock `sys.*` / `media.*` state ids
/// (listed in the agent notes) that Wave 2 seeds; static captions stay inline.
library;

import '../../render/model.dart';
import 'builders.dart';

/// A compact glass metric tile (the `metric.tile` rich widget) — accent icon,
/// big bound numeral + muted unit, small caption. No builders.dart helper exists
/// for this type yet, so it is assembled here directly (keys mirror
/// `lib/render/widgets/metric_tile.dart`). Placed AFTER its panel band so it
/// reads as a self-contained card while staying individually editable.
WidgetNode _metricTile(
  String id, {
  required String label,
  required String icon,
  required Placement placement,
  String? stateBinding,
  String? unit,
  String? value,
  String? color,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'metric.tile',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'label': label,
          'icon': icon,
          'unit': ?unit,
          'value': ?value,
          'color': ?color,
        },
      ),
    );

/// Builds the System Overview [LayoutPage].
LayoutPage systemOverviewPage() {
  // Threshold tints reused across temperature/utilisation readouts so a hot
  // component turns amber → red without bespoke styling per widget.
  const utilRules = <Map<String, dynamic>>[
    {'when': '>=90', 'style': {'theme': 'error'}},
    {'when': '>=75', 'style': {'theme': 'warn'}},
  ];
  const tempRules = <Map<String, dynamic>>[
    {'when': '>=80', 'style': {'theme': 'error'}},
    {'when': '>=65', 'style': {'theme': 'warn'}},
  ];

  return LayoutPage(
    id: 'system-overview',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: [
      // ── Page heading ──────────────────────────────────────────────────────
      sectionHeader(
        'so-title',
        title: 'System Overview',
        trailing: 'LIVE',
        placement: at(0, 0, colSpan: 24, rowSpan: 1),
        color: '#00B4D8',
      ),

      // ── Top metric tiles (CPU / GPU / RAM / VRAM / Storage / Uptime) ───────
      _metricTile(
        'so-tile-cpu',
        label: 'CPU Load',
        icon: 'cpu',
        unit: '%',
        stateBinding: 'sys.cpu.load',
        placement: at(0, 1, colSpan: 4, rowSpan: 2),
        color: '#00B4D8',
        valueRules: utilRules,
      ),
      _metricTile(
        'so-tile-gpu',
        label: 'GPU Load',
        icon: 'gpu',
        unit: '%',
        stateBinding: 'sys.gpu.load',
        placement: at(4, 1, colSpan: 4, rowSpan: 2),
        color: '#7B2FBE',
        valueRules: utilRules,
      ),
      _metricTile(
        'so-tile-ram',
        label: 'RAM Used',
        icon: 'ram',
        unit: 'GB',
        stateBinding: 'sys.ram.used',
        placement: at(8, 1, colSpan: 4, rowSpan: 2),
        color: '#00B4D8',
      ),
      _metricTile(
        'so-tile-temp',
        label: 'CPU Temp',
        icon: 'temp',
        unit: 'C',
        stateBinding: 'sys.cpu.temp',
        placement: at(12, 1, colSpan: 4, rowSpan: 2),
        color: '#00B4D8',
        valueRules: tempRules,
      ),
      _metricTile(
        'so-tile-storage',
        label: 'Storage',
        icon: 'storage',
        unit: 'TB',
        stateBinding: 'sys.storage.used',
        placement: at(16, 1, colSpan: 4, rowSpan: 2),
        color: '#00B4D8',
      ),
      _metricTile(
        'so-tile-uptime',
        label: 'Uptime',
        icon: 'clock',
        stateBinding: 'sys.uptime',
        placement: at(20, 1, colSpan: 4, rowSpan: 2),
        color: '#00E676',
      ),

      // ── System Performance (panel behind, sparkline + min/max/avg on top) ──
      panel(
        'so-perf-panel',
        title: 'System Performance',
        accent: '#00B4D8',
        placement: at(0, 3, colSpan: 9, rowSpan: 6),
      ),
      sparkline(
        'so-perf-cpu',
        stateBinding: 'sys.cpu.history',
        color: '#00B4D8',
        capacity: 64,
        placement: at(1, 4, colSpan: 7, rowSpan: 3),
      ),
      sparkline(
        'so-perf-gpu',
        stateBinding: 'sys.gpu.history',
        color: '#7B2FBE',
        capacity: 64,
        placement: at(1, 4, colSpan: 7, rowSpan: 3),
      ),
      statRow(
        'so-perf-min',
        label: 'Min',
        stateBinding: 'sys.perf.min',
        unit: '%',
        placement: at(1, 7, colSpan: 3, rowSpan: 1),
      ),
      statRow(
        'so-perf-avg',
        label: 'Avg',
        stateBinding: 'sys.perf.avg',
        unit: '%',
        placement: at(4, 7, colSpan: 2, rowSpan: 1),
      ),
      statRow(
        'so-perf-max',
        label: 'Max',
        stateBinding: 'sys.perf.max',
        unit: '%',
        color: '#FFAB40',
        placement: at(6, 7, colSpan: 2, rowSpan: 1),
      ),

      // ── Detailed System Info (panel + stat rows) ──────────────────────────
      panel(
        'so-info-panel',
        title: 'Detailed System Info',
        accent: '#7B2FBE',
        placement: at(9, 3, colSpan: 8, rowSpan: 6),
      ),
      statRow(
        'so-info-os',
        label: 'Operating System',
        stateBinding: 'sys.info.os',
        placement: at(10, 4, colSpan: 6, rowSpan: 1),
      ),
      statRow(
        'so-info-cpu',
        label: 'Processor',
        stateBinding: 'sys.info.cpu',
        placement: at(10, 5, colSpan: 6, rowSpan: 1),
      ),
      statRow(
        'so-info-gpu',
        label: 'Graphics',
        stateBinding: 'sys.info.gpu',
        placement: at(10, 6, colSpan: 6, rowSpan: 1),
      ),
      statRow(
        'so-info-ram',
        label: 'Memory',
        stateBinding: 'sys.info.ram',
        placement: at(10, 7, colSpan: 6, rowSpan: 1),
      ),

      // ── System Health (panel + big 92% ring) ──────────────────────────────
      panel(
        'so-health-panel',
        title: 'System Health',
        accent: '#00E676',
        placement: at(17, 3, colSpan: 7, rowSpan: 6),
      ),
      ring(
        'so-health-ring',
        stateBinding: 'sys.health.score',
        sublabel: 'Excellent',
        unit: '%',
        color: '#00E676',
        placement: at(18, 4, colSpan: 5, rowSpan: 4),
      ),

      // ── Storage Overview (panel + donut ring + legend rows) ────────────────
      panel(
        'so-storage-panel',
        title: 'Storage Overview',
        accent: '#00B4D8',
        placement: at(0, 9, colSpan: 7, rowSpan: 7),
      ),
      ring(
        'so-storage-ring',
        stateBinding: 'sys.storage.usedPct',
        sublabel: 'Used',
        unit: '%',
        color: '#00B4D8',
        placement: at(1, 10, colSpan: 3, rowSpan: 4),
      ),
      statRow(
        'so-storage-system',
        label: 'System',
        stateBinding: 'sys.storage.system',
        unit: ' GB',
        color: '#00B4D8',
        placement: at(4, 10, colSpan: 2, rowSpan: 1),
      ),
      statRow(
        'so-storage-apps',
        label: 'Applications',
        stateBinding: 'sys.storage.apps',
        unit: ' GB',
        color: '#7B2FBE',
        placement: at(4, 11, colSpan: 2, rowSpan: 1),
      ),
      statRow(
        'so-storage-media',
        label: 'Media',
        stateBinding: 'sys.storage.media',
        unit: ' GB',
        color: '#00E676',
        placement: at(4, 12, colSpan: 2, rowSpan: 1),
      ),
      statRow(
        'so-storage-free',
        label: 'Free',
        stateBinding: 'sys.storage.free',
        unit: ' GB',
        placement: at(1, 14, colSpan: 5, rowSpan: 1),
      ),

      // ── Top Processes (panel + table-like stat rows) ──────────────────────
      panel(
        'so-proc-panel',
        title: 'Top Processes',
        accent: '#7B2FBE',
        placement: at(7, 9, colSpan: 10, rowSpan: 7),
      ),
      statRow(
        'so-proc-1',
        label: 'chrome.exe',
        stateBinding: 'sys.proc.0.cpu',
        unit: '%',
        placement: at(8, 10, colSpan: 8, rowSpan: 1),
        valueRules: utilRules,
      ),
      statRow(
        'so-proc-2',
        label: 'GameClient.exe',
        stateBinding: 'sys.proc.1.cpu',
        unit: '%',
        placement: at(8, 11, colSpan: 8, rowSpan: 1),
        valueRules: utilRules,
      ),
      statRow(
        'so-proc-3',
        label: 'Spotify.exe',
        stateBinding: 'sys.proc.2.cpu',
        unit: '%',
        placement: at(8, 12, colSpan: 8, rowSpan: 1),
        valueRules: utilRules,
      ),
      statRow(
        'so-proc-4',
        label: 'Code.exe',
        stateBinding: 'sys.proc.3.cpu',
        unit: '%',
        placement: at(8, 13, colSpan: 8, rowSpan: 1),
        valueRules: utilRules,
      ),
      statRow(
        'so-proc-5',
        label: 'explorer.exe',
        stateBinding: 'sys.proc.4.cpu',
        unit: '%',
        placement: at(8, 14, colSpan: 8, rowSpan: 1),
        valueRules: utilRules,
      ),

      // ── System Alerts (panel + notification items) ────────────────────────
      panel(
        'so-alerts-panel',
        title: 'System Alerts',
        accent: '#FFAB40',
        placement: at(17, 9, colSpan: 7, rowSpan: 7),
      ),
      notificationItem(
        'so-alert-1',
        title: 'GPU Temperature',
        body: 'Operating within normal range',
        time: '2m',
        icon: 'temp',
        color: '#00E676',
        placement: at(18, 10, colSpan: 5, rowSpan: 2),
      ),
      notificationItem(
        'so-alert-2',
        title: 'Storage Threshold',
        body: 'System drive over 70% capacity',
        time: '14m',
        icon: 'storage',
        color: '#FFAB40',
        placement: at(18, 12, colSpan: 5, rowSpan: 2),
      ),
      notificationItem(
        'so-alert-3',
        title: 'Backup Complete',
        body: 'Scheduled backup finished',
        time: '1h',
        icon: 'check',
        color: '#00B4D8',
        placement: at(18, 14, colSpan: 5, rowSpan: 2),
      ),
    ],
  );
}
