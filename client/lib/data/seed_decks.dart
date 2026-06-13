/// Seed/demo decks for Demo Mode — authored with the same render model the engine
/// would send (render/model.dart), so the renderer is exercised exactly as in
/// production. Widget types + appearance/config/interaction keys match the built-in
/// widgets (launcher/media.player/status.list/gauge.circular/gauge.linear/
/// section.header/button/toggle/slider/label).
library;

import '../data/deck_source.dart';
import '../render/model.dart';

/// A seed deck = its summary (for the list) + its layout page (for the renderer).
class SeedDeck {
  const SeedDeck(this.summary, this.page);
  final DeckSummary summary;
  final LayoutPage page;
}

/// Initial values for the mock state ids the seed decks bind. The telemetry ticker
/// (mock_deck_source) drives the `sys.*`/`media.*` ids; the rest change via actions.
Map<String, Object?> seedInitialState() => {
      // Rich Home dashboard — system monitor gauges (CPU/GPU temp °C, RAM GB).
      // The scalar drives the live arc + centre value; each gauge's sparkline +
      // MIN/AVG/MAX row is fed by its literal config.history series.
      'sys.cpu.temp': 42.0,
      'sys.gpu.temp': 55.0,
      'sys.ram': 16.0,
      // Media player card — the media.player widget reads a Map (track/artist/
      // playing/progress). The vertical VOLUME slider reads media.volume.
      'media': const {
        'track': 'Blinding Lights',
        'artist': 'The Weeknd',
        'playing': true,
        'progress': 0.38,
      },
      'media.volume': 70.0,
      'media.track': 'Blinding Lights — The Weeknd',
      'media.playing': true,
      // Legacy ids kept for the simpler decks below.
      'sys.cpu': 28.0,
      'sys.disk': 58.0,
      'sys.clock': '—',
      'home.living': false,
      'home.bedroom': true,
      'home.temp': 21.0,
    };

/// The demo decks shown in Demo Mode. The first one ('system') is the rich Home
/// "Control Center" that the Dashboard nav resolves to.
List<SeedDeck> seedDecks() => [
      SeedDeck(
        const DeckSummary(
            id: 'system',
            title: 'System Monitor',
            subtitle: 'Quick launch · media · system monitor'),
        _homeDashboard(),
      ),
      SeedDeck(
        const DeckSummary(
            id: 'media', title: 'Media', subtitle: 'Transport + volume'),
        _mediaDeck(),
      ),
      SeedDeck(
        const DeckSummary(
            id: 'home', title: 'Smart Home', subtitle: 'Lights + scenes'),
        _homeDeck(),
      ),
    ];

// ---------------------------------------------------------------------------
// HOME "Control Center" dashboard — matches Reference Images/home.png on a
// 24-col x 16-row grid: QUICK LAUNCH row, a wide media player, an action-button
// row, a vertical VOLUME slider, three SYSTEM MONITOR gauges, and a SYSTEM
// STATUS list. Authored data-driven so the Designer can still move/edit it.
// ---------------------------------------------------------------------------

const _homeGrid = GridConfig(columns: 24, rows: 16);

LayoutPage _homeDashboard() => LayoutPage(
      id: 'system',
      grid: _homeGrid,
      version: 2,
      widgets: [
        // QUICK LAUNCH header.
        _sectionHeader('qlh', 'QUICK LAUNCH',
            const Placement(col: 0, row: 0, colSpan: 18, rowSpan: 1)),

        // Row of 5 launcher tiles.
        _launcher('l-disney', 'Disney+', 'play', '#1f6feb',
            'launch.app:disney',
            const Placement(col: 0, row: 1, colSpan: 3, rowSpan: 3)),
        _launcher('l-prime', 'Prime Video', 'play', '#00a8e1',
            'launch.app:prime',
            const Placement(col: 3, row: 1, colSpan: 3, rowSpan: 3)),
        _launcher('l-netflix', 'Netflix', 'play', '#e50914',
            'launch.app:netflix',
            const Placement(col: 6, row: 1, colSpan: 3, rowSpan: 3)),
        _launcher('l-chrome', 'Chrome', 'browser', '#4285f4',
            'launch.app:chrome',
            const Placement(col: 9, row: 1, colSpan: 3, rowSpan: 3)),
        _launcher('l-chatgpt', 'ChatGPT', 'app', '#10a37f',
            'launch.app:chatgpt',
            const Placement(col: 12, row: 1, colSpan: 3, rowSpan: 3)),

        // VOLUME — vertical slider card on the right (spans the launch + media rows).
        _sectionHeader('volh', 'VOLUME',
            const Placement(col: 19, row: 0, colSpan: 5, rowSpan: 1)),
        _verticalSlider('vol', 'media.volume', 'mock.set:media.volume', 0, 100,
            const Placement(col: 20, row: 1, colSpan: 3, rowSpan: 9)),

        // Wide media player card in the centre.
        _mediaPlayer('player', 'media',
            const Placement(col: 0, row: 4, colSpan: 18, rowSpan: 4)),

        // Action button row.
        _iconButton('lock', 'LOCK', 'power', 'system.lock', true,
            const Placement(col: 0, row: 8, colSpan: 4, rowSpan: 2)),
        _iconButton('terminal', 'TERMINAL', 'terminal', 'launch.terminal', false,
            const Placement(col: 4, row: 8, colSpan: 4, rowSpan: 2)),
        _iconButton('files', 'FILE EXPLORER', 'folder', 'launch.files', false,
            const Placement(col: 8, row: 8, colSpan: 5, rowSpan: 2)),
        _iconButton('control', 'CONTROL PANEL', 'settings', 'launch.control', false,
            const Placement(col: 13, row: 8, colSpan: 5, rowSpan: 2)),
        // SLEEP retained as the second destructive action (also exercised in tests).
        _iconButton('sleep', 'SLEEP', 'power', 'system.sleep', true,
            const Placement(col: 19, row: 10, colSpan: 5, rowSpan: 2)),

        // SYSTEM MONITOR header + three circular gauges with sparkline history.
        _sectionHeader('smh', 'SYSTEM MONITOR',
            const Placement(col: 0, row: 10, colSpan: 18, rowSpan: 1)),
        _gaugeHistory('cpu', 'CPU TEMPERATURE', 'sys.cpu.temp',
            const [38, 40, 39, 41, 43, 42, 44, 42, 41, 42], '°C', 0, 100,
            const Placement(col: 0, row: 11, colSpan: 5, rowSpan: 5)),
        _gaugeHistory('gpu', 'GPU TEMPERATURE', 'sys.gpu.temp',
            const [51, 53, 52, 54, 56, 55, 57, 55, 54, 55], '°C', 0, 100,
            const Placement(col: 5, row: 11, colSpan: 5, rowSpan: 5)),
        _gaugeHistory('ram', 'RAM USAGE', 'sys.ram',
            const [14, 15, 15, 16, 17, 16, 16, 15, 16, 16], 'GB', 0, 32,
            const Placement(col: 10, row: 11, colSpan: 5, rowSpan: 5)),

        // SYSTEM STATUS list on the right.
        _statusList(
          'status',
          'SYSTEM STATUS',
          const Placement(col: 15, row: 11, colSpan: 9, rowSpan: 5),
          const [
            {'label': 'Power Plan', 'value': 'Balanced', 'icon': 'bolt'},
            {'label': 'Network', 'value': 'Connected', 'icon': 'network', 'theme': 'success'},
            {'label': 'Storage', 'value': '420 / 512 GB', 'icon': 'storage'},
            {'label': 'Uptime', 'value': '03:42:11', 'icon': 'clock'},
          ],
        ),
      ],
    );

LayoutPage _mediaDeck() => LayoutPage(id: 'media', grid: _grid, version: 1, widgets: [
      _label('track', 'NOW PLAYING', 'media.track', '',
          const Placement(col: 0, row: 0, colSpan: 8, rowSpan: 1)),
      _toggle('play', 'Play / Pause', 'media.playing', 'mock.toggle:media.playing',
          const Placement(col: 0, row: 1, colSpan: 8, rowSpan: 1)),
      _button('prev', 'PREV', 'mock.prev', false,
          const Placement(col: 0, row: 2, colSpan: 4, rowSpan: 2)),
      _button('next', 'NEXT', 'mock.next', false,
          const Placement(col: 4, row: 2, colSpan: 4, rowSpan: 2)),
      _slider('vol', 'media.volume', 'mock.set:media.volume', 0, 100,
          const Placement(col: 0, row: 4, colSpan: 8, rowSpan: 1)),
      _label('vollabel', 'VOLUME', 'media.volume', '%',
          const Placement(col: 0, row: 5, colSpan: 8, rowSpan: 1)),
    ]);

LayoutPage _homeDeck() => LayoutPage(id: 'home', grid: _grid, version: 1, widgets: [
      _toggle('living', 'Living Room', 'home.living', 'mock.toggle:home.living',
          const Placement(col: 0, row: 0, colSpan: 4, rowSpan: 2)),
      _toggle('bedroom', 'Bedroom', 'home.bedroom', 'mock.toggle:home.bedroom',
          const Placement(col: 4, row: 0, colSpan: 4, rowSpan: 2)),
      _gauge('temp', 'gauge.linear', 'home.temp', 'TEMP', '°C',
          const Placement(col: 0, row: 2, colSpan: 8, rowSpan: 1), max: 40),
      _button('movie', 'MOVIE SCENE', 'mock.scene.movie', false,
          const Placement(col: 0, row: 3, colSpan: 4, rowSpan: 2)),
      _button('night', 'NIGHT SCENE', 'mock.scene.night', false,
          const Placement(col: 4, row: 3, colSpan: 4, rowSpan: 2)),
      _label('templabel', 'THERMOSTAT', 'home.temp', '°C',
          const Placement(col: 0, row: 5, colSpan: 8, rowSpan: 1)),
    ]);

const _grid = GridConfig(columns: 8, rows: 6);

// --- node helpers (mirror the engine's default_profile authoring) ---

WidgetNode _sectionHeader(String id, String title, Placement p) => WidgetNode(
      id: id,
      type: 'section.header',
      placement: p,
      appearance: Appearance(style: {'title': title, 'rule': true}),
    );

WidgetNode _launcher(
        String id, String label, String icon, String color, String action, Placement p) =>
    WidgetNode(
      id: id,
      type: 'launcher',
      placement: p,
      appearance: Appearance(style: {'label': label, 'icon': icon, 'color': color}),
      interaction: {
        'tap': {'target': 'action', 'ref': action}
      },
    );

WidgetNode _mediaPlayer(String id, String state, Placement p) => WidgetNode(
      id: id,
      type: 'media.player',
      placement: p,
      appearance: Appearance(
        style: const {'track': 'Blinding Lights', 'artist': 'The Weeknd'},
        stateBinding: state,
      ),
      interaction: const {
        'previous': {'target': 'action', 'ref': 'mock.prev'},
        'playPause': {'target': 'action', 'ref': 'mock.media.toggle'},
        'next': {'target': 'action', 'ref': 'mock.next'},
        'shuffle': {'target': 'action', 'ref': 'mock.shuffle'},
        'repeat': {'target': 'action', 'ref': 'mock.repeat'},
      },
    );

WidgetNode _iconButton(String id, String label, String icon, String action,
        bool confirm, Placement p) =>
    WidgetNode(
      id: id,
      type: 'button',
      placement: p,
      appearance: Appearance(style: {'label': label, 'icon': icon}),
      interaction: {
        'tap': {'target': 'action', 'ref': action}
      },
      config: {'confirm': confirm},
    );

WidgetNode _verticalSlider(
        String id, String state, String action, double min, double max, Placement p) =>
    WidgetNode(
      id: id,
      type: 'slider',
      placement: p,
      appearance: Appearance(
        style: const {'orientation': 'vertical'},
        stateBinding: state,
      ),
      interaction: {
        'dragValue': {'target': 'action', 'ref': action}
      },
      config: {'min': min, 'max': max},
    );

WidgetNode _gaugeHistory(String id, String title, String state,
        List<double> history, String unit, double min, double max, Placement p) =>
    WidgetNode(
      id: id,
      type: 'gauge.circular',
      placement: p,
      // The gauge's inline sparkline + MIN/AVG/MAX row read config.history (a
      // literal series); the bound scalar drives the live arc + centre value.
      appearance: Appearance(style: {'title': title}, stateBinding: state),
      config: {'min': min, 'max': max, 'unit': unit, 'history': history},
    );

WidgetNode _statusList(
        String id, String title, Placement p, List<Map<String, Object?>> items) =>
    WidgetNode(
      id: id,
      type: 'status.list',
      placement: p,
      appearance: Appearance(style: {'title': title}),
      config: {'items': items},
    );

WidgetNode _gauge(String id, String type, String state, String label, String unit,
        Placement p, {double max = 100}) =>
    WidgetNode(
      id: id,
      type: type,
      placement: p,
      appearance: Appearance(style: {'label': label}, stateBinding: state),
      config: {'min': 0.0, 'max': max, 'unit': unit},
    );

WidgetNode _button(String id, String label, String action, bool confirm, Placement p) =>
    WidgetNode(
      id: id,
      type: 'button',
      placement: p,
      appearance: Appearance(style: {'label': label}),
      interaction: {
        'tap': {'target': 'action', 'ref': action}
      },
      config: {'confirm': confirm},
    );

WidgetNode _toggle(String id, String label, String state, String action, Placement p) =>
    WidgetNode(
      id: id,
      type: 'toggle',
      placement: p,
      appearance: Appearance(style: {'label': label}, stateBinding: state),
      interaction: {
        'tap': {'target': 'action', 'ref': action}
      },
    );

WidgetNode _slider(
        String id, String state, String action, double min, double max, Placement p) =>
    WidgetNode(
      id: id,
      type: 'slider',
      placement: p,
      appearance: Appearance(stateBinding: state),
      interaction: {
        'dragValue': {'target': 'action', 'ref': action}
      },
      config: {'min': min, 'max': max},
    );

WidgetNode _label(String id, String label, String state, String unit, Placement p) =>
    WidgetNode(
      id: id,
      type: 'label',
      placement: p,
      appearance: Appearance(style: {'label': label}, stateBinding: state),
      config: {'unit': unit},
    );
