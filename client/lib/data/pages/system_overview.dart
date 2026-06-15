/// System Overview page — the deck's at-a-glance telemetry dashboard, authored
/// under the ONE WIDGET = ONE ENTITY model: every visual CARD is a SINGLE
/// composite node that draws its own card chrome + all sub-content. No card is a
/// `panel` + decomposed cluster any more.
///
/// Composed on a 24×16 grid mirroring the reference render: a row of metric tiles
/// up top (each `metric.tile` is already a single control, so it stays one node);
/// System Performance / Detailed System Info / System Health across the middle
/// band; Storage Overview / Top Processes / System Alerts along the bottom band.
/// All values bind to realistic mock `sys.*` state ids that Wave 2 seeds.
library;

import '../../render/model.dart';
import 'builders.dart';

/// A compact glass metric tile (the `metric.tile` rich widget) — accent icon,
/// big bound numeral + muted unit, small caption. Already a SINGLE-node control
/// (keys mirror `lib/render/widgets/metric_tile.dart`), so it is assembled here
/// directly rather than decomposed.
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

      // ── Top metric tiles (single-node controls) ───────────────────────────
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

      // ── System Performance ── one composite gauge card: a centre value, a
      // Min/Max/Avg stats column derived from the bound history, and the inline
      // trend sparkline beneath — all drawn by ONE node with its own chrome.
      gaugeCircular(
        'so-perf',
        title: 'System Performance',
        stateBinding: 'sys.cpu.load',
        unit: '%',
        color: '#00B4D8',
        placement: at(0, 3, colSpan: 9, rowSpan: 6),
        history: const [42, 48, 55, 61, 58, 64, 70, 66, 59, 63, 71, 68, 62, 57],
        valueRules: utilRules,
      ),

      // ── Detailed System Info ── one list card (OS / CPU / GPU / RAM rows). ──
      listCard(
        'so-info',
        title: 'Detailed System Info',
        color: '#7B2FBE',
        placement: at(9, 3, colSpan: 8, rowSpan: 6),
        items: const [
          {'leading': 'os', 'label': 'Operating System', 'value': 'Windows 11 Pro'},
          {'leading': 'cpu', 'label': 'Processor', 'value': 'Ryzen 9 7950X'},
          {'leading': 'gpu', 'label': 'Graphics', 'value': 'RTX 4090'},
          {'leading': 'ram', 'label': 'Memory', 'value': '64 GB DDR5'},
          {'leading': 'storage', 'label': 'Storage', 'value': '4 TB NVMe'},
        ],
      ),

      // ── System Health ── one ring card (92% Excellent). ────────────────────
      ring(
        'so-health',
        title: 'System Health',
        stateBinding: 'sys.health.score',
        sublabel: 'Excellent',
        unit: '%',
        color: '#00E676',
        placement: at(17, 3, colSpan: 7, rowSpan: 6),
      ),

      // ── Storage Overview ── one ring card (used % donut). ──────────────────
      ring(
        'so-storage',
        title: 'Storage Overview',
        stateBinding: 'sys.storage.usedPct',
        sublabel: 'Used',
        unit: '%',
        color: '#00B4D8',
        placement: at(0, 9, colSpan: 7, rowSpan: 7),
      ),

      // ── Top Processes ── one list card (name + CPU%). ──────────────────────
      listCard(
        'so-proc',
        title: 'Top Processes',
        color: '#7B2FBE',
        placement: at(7, 9, colSpan: 10, rowSpan: 7),
        items: const [
          {'label': 'chrome.exe', 'value': '18.4%', 'color': '#00B4D8'},
          {'label': 'GameClient.exe', 'value': '12.1%', 'color': '#7B2FBE'},
          {'label': 'Spotify.exe', 'value': '6.7%', 'color': '#00E676'},
          {'label': 'Code.exe', 'value': '4.2%', 'color': '#00B4D8'},
          {'label': 'explorer.exe', 'value': '1.9%', 'color': '#7B2FBE'},
        ],
      ),

      // ── System Alerts ── one notification feed card. ───────────────────────
      notificationList(
        'so-alerts',
        title: 'System Alerts',
        color: '#FFAB40',
        placement: at(17, 9, colSpan: 7, rowSpan: 7),
        items: const [
          {
            'icon': 'temp',
            'title': 'GPU Temperature',
            'body': 'Operating within normal range',
            'time': '2m',
            'color': '#00E676',
          },
          {
            'icon': 'storage',
            'title': 'Storage Threshold',
            'body': 'System drive over 70% capacity',
            'time': '14m',
            'color': '#FFAB40',
          },
          {
            'icon': 'check',
            'title': 'Backup Complete',
            'body': 'Scheduled backup finished',
            'time': '1h',
            'color': '#00B4D8',
          },
        ],
      ),
    ],
  );
}
