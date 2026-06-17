/// Gaming Hub page (Wave B) — the cyberpunk command center's gaming surface.
///
/// Authored under the COMPOSITE model: every visual CARD is a SINGLE composite
/// widget node that draws its OWN card chrome + all of its sub-content, so the
/// Designer treats one card as ONE entity (no more `panel` + decomposed gauge /
/// stat-row / sparkline clusters). Individual CONTROLS (game posters, toggles,
/// control tiles) stay one node each — they are already single entities.
///
/// Composed on a 24×16 grid. Sections (mirroring the reference image):
///   * Favorite Games — a poster row (one `game.poster` card per game)
///   * Game Launcher — a single `list.card` of platforms
///   * Game Optimization — labelled toggles (each its own control)
///   * Quick Actions — a grid of control tiles (each its own control)
///   * Live Game Stats — a big FPS `gauge.circular` card + CPU/GPU/RAM
///     `gauge.linear` cards (each gauge is one composite card)
///   * Performance Overview — `metric.tile` cards (each one composite card)
///   * Achievements — a single `status.list` card
///   * Game Profiles — performance `mode.card`s (each one composite card)
///   * Network Status — a single `list.card`
///
/// All live values bind to mock state ids (see the Wave-2 seed list). Nothing
/// here paints visuals — it only emits the layout descriptor.
library;

import '../../render/model.dart';
import 'builders.dart';

/// Builds the Gaming Hub [LayoutPage] (the page-function Wave 2 wires into nav).
LayoutPage gamingHubPage() {
  return LayoutPage(
    id: 'gaming_hub',
    grid: const GridConfig(columns: 24, rows: 16),
    // Every card is a self-contained composite node; controls are single nodes.
    widgets: [
      ..._favoriteGames(),
      ..._gameLauncher(),
      ..._gameOptimization(),
      ..._quickActions(),
      ..._liveGameStats(),
      ..._performanceOverview(),
      ..._achievements(),
      ..._gameProfiles(),
      ..._networkStatus(),
    ],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FAVORITE GAMES — a poster row (cols 0..17, rows 0..4). Each poster is a SINGLE
// `game.poster` composite card (art + title + launch tap); a section header
// labels the row (a between-cards header, not a card).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _favoriteGames() {
  // `steam` is a Steam deep link — `launch.url` opens it, which launches the game
  // via Steam if installed, else opens Steam to it (best-effort real launch).
  final posters = <Map<String, String>>[
    {'id': 'cyberpunk', 'label': 'Cyberpunk 2077', 'sub': 'Last played 2h ago', 'color': '#F2D900', 'steam': 'steam://rungameid/1091500'},
    {'id': 'forza', 'label': 'Forza Horizon', 'sub': 'Last played today', 'color': '#3BA7FF', 'steam': 'steam://rungameid/1551360'},
    {'id': 'elden', 'label': 'Elden Ring', 'sub': 'Last played 3d ago', 'color': '#C9A24B', 'steam': 'steam://rungameid/1245620'},
    {'id': 'rdr2', 'label': 'Red Dead 2', 'sub': 'Last played 1w ago', 'color': '#C0392B', 'steam': 'steam://rungameid/1174180'},
    {'id': 'cod', 'label': 'Call of Duty', 'sub': 'Last played today', 'color': '#5DAE3A', 'steam': 'steam://rungameid/1938090'},
    {'id': 'baldurs', 'label': "Baldur's Gate 3", 'sub': 'Last played 5d ago', 'color': '#B5651D', 'steam': 'steam://rungameid/1086940'},
  ];

  return [
    sectionHeader('fav.header',
        placement: at(0, 0, colSpan: 18, rowSpan: 1),
        title: 'Favorite Games',
        trailing: 'Launch · Manage · Optimize',
        color: 'accent-purple'),
    for (var i = 0; i < posters.length; i++)
      gamePoster('fav.${posters[i]['id']}',
          placement: at(i * 3, 1, colSpan: 3, rowSpan: 3),
          title: posters[i]['label']!,
          subtitle: posters[i]['sub'],
          color: posters[i]['color'],
          action: 'launch.url',
          param: posters[i]['steam']),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME LAUNCHER — ONE `list.card` of platform launchers (cols 18..23, rows 0..7).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _gameLauncher() {
  return [
    listCard('launch.list',
        placement: at(18, 0, colSpan: 6, rowSpan: 8),
        title: 'Game Launcher',
        color: 'accent-purple',
        items: const [
          {'leading': 'app', 'label': 'Steam', 'value': 'Launch', 'color': '#3BA7FF'},
          {'leading': 'app', 'label': 'Epic Games', 'value': 'Launch', 'color': '#F2F3FF'},
          {'leading': 'app', 'label': 'Battle.net', 'value': 'Launch', 'color': '#3BA7FF'},
          {'leading': 'app', 'label': 'GOG Galaxy', 'value': 'Launch', 'color': '#B5651D'},
          {'leading': 'game', 'label': 'Xbox App', 'value': 'Launch', 'color': '#5DAE3A'},
        ]),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME OPTIMIZATION — a row of labelled TOGGLES (cols 0..17, rows 5..7). Each
// toggle is a single CONTROL node (carries its own label); a section header
// labels the row.
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
    sectionHeader('opt.header',
        placement: at(0, 5, colSpan: 18, rowSpan: 1),
        title: 'Game Optimization',
        color: accent),
    for (var i = 0; i < toggles.length; i++)
      toggle('opt.${toggles[i]['id']}',
          placement: at(i * 4, 6, colSpan: 4, rowSpan: 1),
          label: toggles[i]['label']!,
          stateBinding: toggles[i]['state'],
          action: 'game.opt.toggle.${toggles[i]['id']}',
          color: accent),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS — a grid of CONTROL TILES (cols 18..23, rows 8..11). Each tile
// is a single control node.
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
    sectionHeader('qa.header',
        placement: at(18, 8, colSpan: 6, rowSpan: 1),
        title: 'Quick Actions',
        color: accent),
    for (var i = 0; i < actions.length; i++)
      controlTile('qa.${actions[i]['id']}',
          placement: at(18 + (i % 3) * 2, 9 + (i ~/ 3) * 2, colSpan: 2, rowSpan: 2),
          label: actions[i]['label']!,
          icon: actions[i]['icon']!,
          action: 'game.action.${actions[i]['id']}',
          color: accent),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// LIVE GAME STATS — a big FPS `gauge.circular` CARD + CPU/GPU/RAM `gauge.linear`
// CARDS (cols 0..8, rows 8..15). Each gauge is its OWN composite card node.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _liveGameStats() {
  return [
    // The headline FPS gauge — one composite card (ring + min/max/avg + spark).
    gaugeCircular('live.fps',
        placement: at(0, 8, colSpan: 5, rowSpan: 8),
        stateBinding: 'game.fps',
        title: 'Live Game Stats',
        sublabel: 'FPS',
        min: 0,
        max: 240,
        color: 'accent-cyan',
        history: const [118, 122, 130, 126, 134, 140, 138, 144, 142, 144],
        valueRules: const [
          {'when': '<60', 'style': {'color': '#FF5252'}},
          {'when': '<120', 'style': {'color': '#FFAB40'}},
        ]),
    // CPU / GPU / RAM utilisation — each a single titled linear-gauge card.
    gaugeLinear('live.cpu',
        placement: at(5, 8, colSpan: 4, rowSpan: 3),
        stateBinding: 'sys.cpu.load',
        card: true,
        title: 'CPU',
        unit: '%',
        color: 'accent-cyan'),
    gaugeLinear('live.gpu',
        placement: at(5, 11, colSpan: 4, rowSpan: 3),
        stateBinding: 'sys.gpu.load',
        card: true,
        title: 'GPU',
        unit: '%',
        color: 'accent-purple'),
    gaugeLinear('live.ram',
        placement: at(5, 14, colSpan: 4, rowSpan: 2),
        stateBinding: 'sys.ram',
        card: true,
        title: 'RAM',
        unit: '%',
        color: '#00E676'),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// PERFORMANCE OVERVIEW — a single row of `metric.tile` CARDS (cols 9..17,
// rows 8..10). Each tile is one composite card node.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _performanceOverview() {
  final tiles = <Map<String, dynamic>>[
    {'id': 'cpu', 'icon': 'cpu', 'label': 'CPU', 'unit': '%', 'state': 'sys.cpu.load', 'color': 'accent-cyan'},
    {'id': 'gpu', 'icon': 'gpu', 'label': 'GPU', 'unit': '%', 'state': 'sys.gpu.load', 'color': 'accent-purple'},
    {'id': 'cputemp', 'icon': 'temp', 'label': 'CPU Temp', 'unit': '°C', 'state': 'sys.cpu.temp', 'color': '#FFAB40'},
    {'id': 'gputemp', 'icon': 'temp', 'label': 'GPU Temp', 'unit': '°C', 'state': 'sys.gpu.temp', 'color': '#FF5252'},
  ];

  return [
    for (var i = 0; i < tiles.length; i++)
      _metricTile('perf.${tiles[i]['id']}',
          placement: at(9 + i * 2, 8, colSpan: 2, rowSpan: 2),
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
// ACHIEVEMENTS — ONE `status.list` card of recent unlocks (cols 18..23, r 12..15).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _achievements() {
  return [
    statusList('ach.list',
        placement: at(18, 13, colSpan: 6, rowSpan: 3),
        title: 'Achievements',
        color: '#F2D900',
        items: const [
          {'label': 'Master Explorer', 'value': 'Unlocked', 'icon': 'star', 'color': '#F2D900'},
          {'label': 'Speedrunner', 'value': '+450 XP', 'icon': 'bolt', 'color': '#00B4D8'},
          {'label': 'Survivor', 'value': '78%', 'icon': 'check', 'color': '#00E676'},
        ]),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// GAME PROFILES — performance `mode.card`s (cols 9..12, rows 10..15). Each mode
// is one composite card (icon + name + description + ACTIVATE), the active one
// reflecting the bound profile.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _gameProfiles() {
  const accent = 'accent-cyan';
  final profiles = <Map<String, String>>[
    {'id': 'competitive', 'label': 'Competitive', 'desc': 'Max FPS · low latency', 'icon': 'bolt', 'state': 'game.profile.competitive'},
    {'id': 'aaa', 'label': 'AAA Gaming', 'desc': 'Ultra visuals', 'icon': 'game', 'state': 'game.profile.aaa'},
    {'id': 'streaming', 'label': 'Streaming', 'desc': 'Capture + encode', 'icon': 'camera', 'state': 'game.profile.streaming'},
    {'id': 'balanced', 'label': 'Balanced', 'desc': 'Everyday default', 'icon': 'settings', 'state': 'game.profile.balanced'},
  ];

  return [
    for (var i = 0; i < profiles.length; i++)
      modeCard('profiles.${profiles[i]['id']}',
          placement: at(9 + (i % 2) * 2, 10 + (i ~/ 2) * 3, colSpan: 2, rowSpan: 3),
          name: profiles[i]['label']!,
          description: profiles[i]['desc'],
          icon: profiles[i]['icon'],
          stateBinding: profiles[i]['state'],
          action: 'game.profile.set.${profiles[i]['id']}',
          color: accent),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// NETWORK STATUS — ONE `list.card` of ping / down / up (cols 13..17, r 12..15).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _networkStatus() {
  return [
    listCard('net.list',
        placement: at(13, 10, colSpan: 5, rowSpan: 6),
        title: 'Network Status',
        color: '#00E676',
        items: const [
          {'leading': 'bolt', 'label': 'Ping', 'value': '18 ms', 'color': '#00E676'},
          {'leading': 'download', 'label': 'Download', 'value': '125.6 Mb/s', 'color': '#00B4D8'},
          {'leading': 'upload', 'label': 'Upload', 'value': '42.3 Mb/s', 'color': '#A78BFA'},
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
