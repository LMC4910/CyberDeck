/// Seed/demo decks for Demo Mode — authored with the same render model the engine
/// would send (render/model.dart), so the renderer is exercised exactly as in
/// production. Widget types + appearance/config/interaction keys match the built-in
/// widgets (gauge.circular/linear, button, toggle, slider, label).
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
/// drives `sys.*`; the rest change only via actions (toggle/slider).
Map<String, Object?> seedInitialState() => {
      'sys.cpu': 28.0,
      'sys.ram': 46.0,
      'sys.disk': 58.0,
      'sys.clock': '—',
      'media.playing': false,
      'media.volume': 50.0,
      'media.track': 'Neon Skyline — Synthwave',
      'home.living': false,
      'home.bedroom': true,
      'home.temp': 21.0,
    };

/// The demo decks shown in Demo Mode.
List<SeedDeck> seedDecks() => [
      SeedDeck(
        const DeckSummary(
            id: 'system',
            title: 'System Monitor',
            subtitle: 'Live CPU / RAM / disk + quick power'),
        _systemDeck(),
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

const _grid = GridConfig(columns: 8, rows: 6);

LayoutPage _systemDeck() => LayoutPage(id: 'system', grid: _grid, version: 1, widgets: [
      _gauge('cpu', 'gauge.circular', 'sys.cpu', 'CPU', '%',
          const Placement(col: 0, row: 0, colSpan: 4, rowSpan: 3)),
      _gauge('ram', 'gauge.circular', 'sys.ram', 'RAM', '%',
          const Placement(col: 4, row: 0, colSpan: 4, rowSpan: 3)),
      _gauge('disk', 'gauge.linear', 'sys.disk', 'DISK', '%',
          const Placement(col: 0, row: 3, colSpan: 5, rowSpan: 1)),
      _label('clock', 'TIME', 'sys.clock', '',
          const Placement(col: 5, row: 3, colSpan: 3, rowSpan: 1)),
      _button('lock', 'LOCK', 'system.lock', false,
          const Placement(col: 0, row: 4, colSpan: 4, rowSpan: 2)),
      _button('sleep', 'SLEEP', 'system.sleep', true,
          const Placement(col: 4, row: 4, colSpan: 4, rowSpan: 2)),
    ]);

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

// --- node helpers (mirror the engine's default_profile authoring) ---

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
