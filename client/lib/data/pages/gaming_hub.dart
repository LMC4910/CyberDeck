/// Gaming Hub page (Wave 1) — the cyberpunk command center's gaming surface.
///
/// Authored under the GRANULARITY MODEL: every visual "card" is a glass [panel]
/// placed FIRST (so the interpreter paints it BEHIND), then small BARE widgets
/// (gauge rings, stat rows, sparklines, labels, control/launcher tiles, toggles)
/// are placed AFTER, on top, each individually editable by the Designer.
///
/// Composed on a 24×16 grid. Sections (mirroring the reference):
///   * Favorite Games poster row
///   * Game Optimization toggles
///   * Live Game Stats — big FPS gauge + CPU/GPU/RAM bars
///   * Performance Overview metric tiles + a frametime sparkline
///   * Game Profiles
///   * Network Status
///   * Game Launcher list
///   * Quick Actions
///   * Achievements
///
/// All live values bind to mock state ids (see the file footer / Wave-2 seed
/// list). Nothing here paints visuals — it only emits the layout descriptor.
library;

import '../../render/model.dart';
import 'builders.dart';

/// Builds the Gaming Hub [LayoutPage] (the page-function Wave 2 wires into nav).
LayoutPage gamingHubPage() {
  return LayoutPage(
    id: 'gaming_hub',
    grid: const GridConfig(columns: 24, rows: 16),
    // ORDER MATTERS: panels first (painted behind), bare content after (on top).
    widgets: [
      ..._favoriteGames(),
      ..._gameOptimization(),
      ..._liveGameStats(),
      ..._performanceOverview(),
      ..._gameProfiles(),
      ..._networkStatus(),
      ..._gameLauncher(),
      ..._quickActions(),
      ..._achievements(),
    ],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FAVORITE GAMES — a wide poster row across the top-left (cols 0..17, rows 0..4)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _favoriteGames() {
  const accent = 'accent-purple';
  final posters = <Map<String, String>>[
    {'id': 'cyberpunk', 'label': 'Cyberpunk 2077', 'color': '#F2D900'},
    {'id': 'forza', 'label': 'Forza Horizon', 'color': '#3BA7FF'},
    {'id': 'elden', 'label': 'Elden Ring', 'color': '#C9A24B'},
    {'id': 'rdr2', 'label': 'Red Dead 2', 'color': '#C0392B'},
    {'id': 'cod', 'label': 'Call of Duty', 'color': '#5DAE3A'},
    {'id': 'baldurs', 'label': "Baldur's Gate 3", 'color': '#B5651D'},
  ];

  return [
    panel('fav.panel', placement: at(0, 0, colSpan: 18, rowSpan: 5),
        title: 'Favorite Games', accent: accent),
    label('fav.subtitle',
        placement: at(1, 1, colSpan: 12, rowSpan: 1),
        text: 'Launch, manage and optimize your games',
        font: 'body',
        color: '#8E92C4'),
    for (var i = 0; i < posters.length; i++)
      launcher('fav.${posters[i]['id']}',
          placement: at(1 + i * 3, 2, colSpan: 3, rowSpan: 3),
          label: posters[i]['label']!,
          icon: 'game',
          color: posters[i]['color'],
          action: 'game.launch.${posters[i]['id']}'),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME OPTIMIZATION — a row of labeled toggles (cols 0..17, rows 5..8)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _gameOptimization() {
  const accent = 'accent-cyan';
  final toggles = <Map<String, String>>[
    {'id': 'perf', 'label': 'Performance Mode', 'state': 'game.opt.performance'},
    {'id': 'boost', 'label': 'Network Boost', 'state': 'game.opt.networkBoost'},
    {'id': 'gpu', 'label': 'GPU Overclock', 'state': 'game.opt.gpuOverclock'},
    {'id': 'temp', 'label': 'Temperature Control', 'state': 'game.opt.tempControl'},
  ];

  return [
    panel('opt.panel', placement: at(0, 5, colSpan: 18, rowSpan: 3),
        title: 'Game Optimization', accent: accent),
    for (var i = 0; i < toggles.length; i++) ...[
      label('opt.${toggles[i]['id']}.label',
          placement: at(1 + i * 4, 6, colSpan: 3, rowSpan: 1),
          text: toggles[i]['label']!,
          font: 'body',
          color: '#B9BCE0'),
      toggle('opt.${toggles[i]['id']}.toggle',
          placement: at(1 + i * 4, 7, colSpan: 3, rowSpan: 1),
          stateBinding: toggles[i]['state'],
          action: 'game.opt.toggle.${toggles[i]['id']}',
          color: accent),
    ],
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// LIVE GAME STATS — big FPS gauge + CPU/GPU/RAM bars (cols 0..8, rows 8..16)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _liveGameStats() {
  const accent = 'accent-cyan';
  return [
    panel('live.panel', placement: at(0, 8, colSpan: 9, rowSpan: 8),
        title: 'Live Game Stats', accent: accent),
    // Big FPS gauge (centre value reads the live FPS).
    gaugeCircular('live.fps',
        placement: at(1, 9, colSpan: 4, rowSpan: 6),
        stateBinding: 'game.fps',
        sublabel: 'FPS',
        unit: '',
        min: 0,
        max: 240,
        color: accent,
        valueRules: [
          {'when': '<60', 'style': {'color': '#FF5252'}},
          {'when': '<120', 'style': {'color': '#FFAB40'}},
        ]),
    // CPU / GPU / RAM utilization bars stacked on the right of the panel.
    gaugeLinear('live.cpu',
        placement: at(5, 9, colSpan: 3, rowSpan: 2),
        stateBinding: 'sys.cpu.load',
        label: 'CPU',
        unit: '%',
        color: 'accent-cyan'),
    gaugeLinear('live.gpu',
        placement: at(5, 11, colSpan: 3, rowSpan: 2),
        stateBinding: 'sys.gpu.load',
        label: 'GPU',
        unit: '%',
        color: 'accent-purple'),
    gaugeLinear('live.ram',
        placement: at(5, 13, colSpan: 3, rowSpan: 2),
        stateBinding: 'sys.ram',
        label: 'RAM',
        unit: '%',
        color: '#00E676'),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// PERFORMANCE OVERVIEW — metric tiles + frametime sparkline (cols 9..17, r 8..12)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _performanceOverview() {
  const accent = 'accent-purple';
  final tiles = <Map<String, dynamic>>[
    {'id': 'cpu', 'icon': 'cpu', 'label': 'CPU', 'unit': '%', 'state': 'sys.cpu.load', 'color': 'accent-cyan'},
    {'id': 'gpu', 'icon': 'gpu', 'label': 'GPU', 'unit': '%', 'state': 'sys.gpu.load', 'color': 'accent-purple'},
    {'id': 'cputemp', 'icon': 'temp', 'label': 'CPU Temp', 'unit': '°C', 'state': 'sys.cpu.temp', 'color': '#FFAB40'},
    {'id': 'gputemp', 'icon': 'temp', 'label': 'GPU Temp', 'unit': '°C', 'state': 'sys.gpu.temp', 'color': '#FF5252'},
  ];

  return [
    panel('perf.panel', placement: at(9, 8, colSpan: 9, rowSpan: 4),
        title: 'Performance Overview', accent: accent),
    for (var i = 0; i < tiles.length; i++)
      _metricTile('perf.${tiles[i]['id']}',
          placement: at(10 + i * 2, 9, colSpan: 2, rowSpan: 2),
          stateBinding: tiles[i]['state'] as String,
          icon: tiles[i]['icon'] as String,
          label: tiles[i]['label'] as String,
          unit: tiles[i]['unit'] as String,
          color: tiles[i]['color'] as String,
          valueRules: const [
            {'when': '>85', 'style': {'color': '#FF5252'}},
          ]),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME PROFILES — selectable profile control tiles (cols 9..17, rows 12..16)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _gameProfiles() {
  const accent = 'accent-cyan';
  final profiles = <Map<String, String>>[
    {'id': 'competitive', 'label': 'Competitive', 'icon': 'bolt'},
    {'id': 'aaa', 'label': 'AAA Gaming', 'icon': 'game'},
    {'id': 'streaming', 'label': 'Streaming', 'icon': 'camera'},
    {'id': 'balanced', 'label': 'Balanced', 'icon': 'settings'},
  ];

  return [
    panel('profiles.panel', placement: at(9, 12, colSpan: 5, rowSpan: 4),
        title: 'Game Profiles', accent: accent),
    label('profiles.active',
        placement: at(10, 13, colSpan: 3, rowSpan: 1),
        stateBinding: 'game.profile.active',
        font: 'mono',
        color: accent),
    for (var i = 0; i < profiles.length; i++)
      controlTile('profiles.${profiles[i]['id']}',
          placement: at(10 + i % 2 * 2, 14 + (i ~/ 2), colSpan: 2, rowSpan: 1),
          label: profiles[i]['label']!,
          icon: profiles[i]['icon']!,
          action: 'game.profile.set.${profiles[i]['id']}',
          color: accent),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// NETWORK STATUS — ping / down / up stat rows (cols 14..17, rows 12..16)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _networkStatus() {
  const accent = '#00E676';
  return [
    panel('net.panel', placement: at(14, 12, colSpan: 4, rowSpan: 4),
        title: 'Network Status', accent: accent),
    statRow('net.ping',
        label: 'Ping',
        placement: at(15, 13, colSpan: 2, rowSpan: 1),
        stateBinding: 'net.ping',
        unit: 'ms',
        color: accent,
        valueRules: const [
          {'when': '>60', 'style': {'color': '#FFAB40'}},
          {'when': '>120', 'style': {'color': '#FF5252'}},
        ]),
    statRow('net.down',
        label: 'Download',
        placement: at(15, 14, colSpan: 2, rowSpan: 1),
        stateBinding: 'net.download',
        unit: 'Mb/s',
        color: 'accent-cyan'),
    statRow('net.up',
        label: 'Upload',
        placement: at(15, 15, colSpan: 2, rowSpan: 1),
        stateBinding: 'net.upload',
        unit: 'Mb/s',
        color: 'accent-purple'),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME LAUNCHER — a list of platform launchers (cols 18..23, rows 0..7)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _gameLauncher() {
  const accent = 'accent-purple';
  final launchers = <Map<String, String>>[
    {'id': 'steam', 'label': 'Steam', 'icon': 'app', 'color': '#3BA7FF'},
    {'id': 'epic', 'label': 'Epic Games', 'icon': 'app', 'color': '#F2F3FF'},
    {'id': 'battlenet', 'label': 'Battle.net', 'icon': 'app', 'color': '#3BA7FF'},
    {'id': 'gog', 'label': 'GOG Galaxy', 'icon': 'app', 'color': '#B5651D'},
    {'id': 'xbox', 'label': 'Xbox App', 'icon': 'game', 'color': '#5DAE3A'},
  ];

  return [
    panel('launch.panel', placement: at(18, 0, colSpan: 6, rowSpan: 8),
        title: 'Game Launcher', accent: accent),
    for (var i = 0; i < launchers.length; i++) ...[
      iconButton('launch.${launchers[i]['id']}',
          icon: launchers[i]['icon']!,
          placement: at(19, 1 + i, colSpan: 1, rowSpan: 1),
          action: 'launcher.open.${launchers[i]['id']}',
          color: launchers[i]['color']),
      label('launch.${launchers[i]['id']}.label',
          placement: at(20, 1 + i, colSpan: 3, rowSpan: 1),
          text: launchers[i]['label']!,
          font: 'body',
          color: '#B9BCE0'),
    ],
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS — a grid of control tiles (cols 18..23, rows 8..11)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _quickActions() {
  const accent = 'accent-cyan';
  final actions = <Map<String, String>>[
    {'id': 'record', 'label': 'Record', 'icon': 'camera'},
    {'id': 'screenshot', 'label': 'Screenshot', 'icon': 'camera'},
    {'id': 'discord', 'label': 'Discord', 'icon': 'mic'},
    {'id': 'overlay', 'label': 'Overlay', 'icon': 'info'},
    {'id': 'fps', 'label': 'FPS Counter', 'icon': 'bolt'},
    {'id': 'mute', 'label': 'Mute', 'icon': 'mute'},
  ];

  return [
    panel('qa.panel', placement: at(18, 8, colSpan: 6, rowSpan: 4),
        title: 'Quick Actions', accent: accent),
    for (var i = 0; i < actions.length; i++)
      controlTile('qa.${actions[i]['id']}',
          placement: at(19 + i % 3, 9 + (i ~/ 3), colSpan: 1, rowSpan: 2),
          label: actions[i]['label']!,
          icon: actions[i]['icon']!,
          action: 'game.action.${actions[i]['id']}',
          color: accent),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// ACHIEVEMENTS — a status list of recent unlocks (cols 18..23, rows 12..16)
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _achievements() {
  const accent = '#F2D900';
  return [
    panel('ach.panel', placement: at(18, 12, colSpan: 6, rowSpan: 4),
        title: 'Achievements', accent: accent),
    statusList('ach.list',
        placement: at(19, 13, colSpan: 4, rowSpan: 3),
        color: accent,
        items: const [
          {'label': 'Master Explorer', 'value': 'Unlocked', 'icon': 'star', 'color': '#F2D900'},
          {'label': 'Speedrunner', 'value': '+450 XP', 'icon': 'bolt', 'color': '#00B4D8'},
          {'label': 'Survivor', 'value': '78%', 'icon': 'check', 'color': '#00E676'},
        ]),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// metric.tile node builder (no helper exists in builders.dart for this type).
// Mirrors the keys read by lib/render/widgets/metric_tile.dart exactly.
// ──────────────────────────────────────────────────────────────────────────
WidgetNode _metricTile(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? icon,
  String? label,
  String? unit,
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
          'icon': ?icon,
          'label': ?label,
          'unit': ?unit,
          'color': ?color,
        },
      ),
    );
