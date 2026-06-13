/// Smart Home page (Wave 1) — a cyberpunk "command center" for the home: a Rooms
/// overview strip, Device Control toggles, Scenes & Automations tiles, an Energy
/// Monitor (ring + bars), Security Camera thumbnails and a Recent Activity feed.
///
/// Authored under the locked GRANULARITY MODEL: every visual "card" is a glass
/// [panel] placed FIRST (so the interpreter paints it BEHIND) with small BARE
/// widgets (gauges, stat rows, toggles, control tiles, labels, sparklines)
/// clustered ON TOP — each one individually editable in the Designer. Nothing
/// here hardcodes palette literals; colours come from the theme tokens via the
/// builders' `color`/`theme` keys, and all live values bind to mock state ids
/// (listed in the file footer for Wave 2 to seed).
///
/// Composed on a 24×16 grid. Export: [smartHomePage].
library;

import '../../render/model.dart';
import 'builders.dart';

// Accent palette (token hexes from theme/tokens.dart — kept as named consts so
// the page reads cleanly and the Designer still sees plain `#RRGGBB` values).
const String _cyan = '#00B4D8';
const String _purple = '#7B2FBE';
const String _green = '#00E676';
const String _amber = '#FFAB40';

/// The Smart Home layout: a grid of panels + bare widgets (see file header).
LayoutPage smartHomePage() {
  final widgets = <WidgetNode>[
    // ── Page header ──────────────────────────────────────────────────────
    label(
      'sh.header.title',
      placement: at(0, 0, colSpan: 12, rowSpan: 1),
      text: 'SMART HOME',
      font: 'display',
      color: _cyan,
    ),
    label(
      'sh.header.sub',
      placement: at(0, 1, colSpan: 12, rowSpan: 1),
      text: 'Control and monitor your home environment',
      color: _cyan,
    ),
    label(
      'sh.header.clock',
      placement: at(19, 0, colSpan: 5, rowSpan: 1),
      stateBinding: 'sys.clock',
      text: '10:30 AM',
      font: 'mono',
      color: _cyan,
    ),

    // ── Rooms overview (left) ────────────────────────────────────────────
    sectionHeader(
      'sh.rooms.head',
      title: 'Rooms Overview',
      placement: at(0, 2, colSpan: 13, rowSpan: 1),
      trailing: 'VIEW ALL',
      rule: true,
      color: _cyan,
    ),
    // Five room cards: each is a panel (behind) + an icon, name, status and a
    // bound temperature label (on top).
    ..._roomCard('living', 'Living Room', 'light', _cyan, col: 0),
    ..._roomCard('bedroom', 'Bedroom', 'home', _purple, col: 5),
    ..._roomCard('kitchen', 'Kitchen', 'bolt', _amber, col: 10),
    ..._roomCard('office', 'Office', 'cpu', _cyan, col: 15),
    ..._roomCard('bathroom', 'Bathroom', 'temp', _purple, col: 20),

    // ── Device control (left-bottom) ─────────────────────────────────────
    panel(
      'sh.devices.panel',
      placement: at(0, 8, colSpan: 13, rowSpan: 8),
      title: 'Device Control',
      accent: _cyan,
    ),
    ..._deviceToggle('lights', 'Ceiling Lights', 'light', 'home.lights.ceiling',
        'home.lights.ceiling.toggle', _amber, col: 1, row: 9),
    ..._deviceToggle('floor', 'Floor Lamp', 'bulb', 'home.lights.floor',
        'home.lights.floor.toggle', _amber, col: 7, row: 9),
    ..._deviceToggle('tv', 'Smart TV', 'app', 'home.tv',
        'home.tv.toggle', _purple, col: 1, row: 11),
    ..._deviceToggle('speaker', 'Speaker', 'volume', 'home.speaker',
        'home.speaker.toggle', _cyan, col: 7, row: 11),
    ..._deviceToggle('ac', 'AC Unit', 'temp', 'home.ac',
        'home.ac.toggle', _cyan, col: 1, row: 13),
    ..._deviceToggle('coffee', 'Coffee Maker', 'bolt', 'home.coffee',
        'home.coffee.toggle', _amber, col: 7, row: 13),

    // ── Scenes & automations (middle) ────────────────────────────────────
    panel(
      'sh.scenes.panel',
      placement: at(13, 8, colSpan: 7, rowSpan: 8),
      title: 'Scenes & Automations',
      accent: _purple,
    ),
    controlTile('sh.scene.goodnight',
        label: 'Good Night',
        icon: 'home',
        action: 'home.scene.goodnight',
        placement: at(14, 9, colSpan: 2, rowSpan: 2),
        color: _purple),
    controlTile('sh.scene.movie',
        label: 'Movie Time',
        icon: 'app',
        action: 'home.scene.movie',
        placement: at(16, 9, colSpan: 2, rowSpan: 2),
        color: _cyan),
    controlTile('sh.scene.party',
        label: 'Party Mode',
        icon: 'star',
        action: 'home.scene.party',
        placement: at(18, 9, colSpan: 2, rowSpan: 2),
        color: _amber),
    controlTile('sh.scene.focus',
        label: 'Work Focus',
        icon: 'cpu',
        action: 'home.scene.focus',
        placement: at(14, 11, colSpan: 2, rowSpan: 2),
        color: _cyan),
    controlTile('sh.scene.morning',
        label: 'Morning',
        icon: 'bolt',
        action: 'home.scene.morning',
        placement: at(16, 11, colSpan: 2, rowSpan: 2),
        color: _amber),
    controlTile('sh.scene.away',
        label: 'Away',
        icon: 'power',
        action: 'home.scene.away',
        placement: at(18, 11, colSpan: 2, rowSpan: 2),
        color: _purple),
    sectionHeader(
      'sh.scenes.auto',
      title: 'Automations',
      placement: at(14, 13, colSpan: 5, rowSpan: 1),
      trailing: '4 ACTIVE',
      color: _green,
    ),
    toggle('sh.auto.sunset',
        placement: at(14, 14, colSpan: 5, rowSpan: 1),
        stateBinding: 'home.auto.sunset',
        label: 'Sunset lights',
        action: 'home.auto.sunset.toggle',
        color: _amber),

    // ── Energy monitor (right) ───────────────────────────────────────────
    panel(
      'sh.energy.panel',
      placement: at(20, 2, colSpan: 4, rowSpan: 6),
      title: 'Energy Monitor',
      accent: _green,
    ),
    ring('sh.energy.ring',
        placement: at(20, 3, colSpan: 4, rowSpan: 3),
        stateBinding: 'home.energy.now',
        sublabel: 'Watts now',
        min: 0,
        max: 500,
        color: _green,
        valueRules: const [
          {
            'when': '>350',
            'style': {'color': _amber}
          },
          {
            'when': '>450',
            'style': {'theme': 'error'}
          },
        ]),
    statRow('sh.energy.today',
        label: 'Today',
        placement: at(20, 6, colSpan: 4, rowSpan: 1),
        stateBinding: 'home.energy.today',
        unit: ' kWh',
        color: _green),
    statRow('sh.energy.cost',
        label: 'Est. Cost',
        placement: at(20, 7, colSpan: 4, rowSpan: 1),
        stateBinding: 'home.energy.cost',
        color: _amber),

    // ── Weather / environment strip (top-right) ──────────────────────────
    panel(
      'sh.weather.panel',
      placement: at(13, 0, colSpan: 6, rowSpan: 2),
      accent: _cyan,
    ),
    statRow('sh.weather.temp',
        label: 'Outside',
        placement: at(13, 0, colSpan: 6, rowSpan: 1),
        stateBinding: 'home.weather.temp',
        unit: '°C',
        color: _cyan),
    statRow('sh.weather.humid',
        label: 'Humidity',
        placement: at(13, 1, colSpan: 6, rowSpan: 1),
        stateBinding: 'home.weather.humidity',
        unit: '%',
        color: _purple),

    // ── Security cameras (bottom strip is shared with activity) ──────────
    sectionHeader(
      'sh.cams.head',
      title: 'Security Cameras',
      placement: at(0, 6, colSpan: 13, rowSpan: 1),
      trailing: 'ALL ONLINE',
      color: _green,
    ),
    ..._cameraThumb('front', 'Front Door', 'home.cam.front', col: 0),
    ..._cameraThumb('back', 'Backyard', 'home.cam.back', col: 4),
    ..._cameraThumb('garage', 'Garage', 'home.cam.garage', col: 8),

    // ── Recent activity (far right) ──────────────────────────────────────
    statusList('sh.activity.list',
        placement: at(20, 8, colSpan: 4, rowSpan: 8),
        title: 'Recent Activity',
        color: _cyan,
        items: const [
          {
            'label': 'Front door unlocked',
            'value': '2m',
            'icon': 'check',
            'theme': 'success'
          },
          {
            'label': 'Living room lights on',
            'value': '14m',
            'icon': 'light',
            'color': _amber
          },
          {
            'label': 'Motion: Backyard',
            'value': '31m',
            'icon': 'camera',
            'theme': 'warn'
          },
          {
            'label': 'Thermostat → 22°C',
            'value': '1h',
            'icon': 'temp',
            'color': _cyan
          },
          {
            'label': 'Good Night scene ran',
            'value': '8h',
            'icon': 'home',
            'color': _purple
          },
        ]),
  ];

  return LayoutPage(
    id: 'smart_home',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: widgets,
  );
}

/// A single Rooms-overview card: a glass [panel] behind, with a room icon, name,
/// "Active devices" sublabel and a live temperature label on top. 5 cols wide,
/// rows 3–5 of the grid.
List<WidgetNode> _roomCard(
  String key,
  String name,
  String icon,
  String accent, {
  required int col,
}) {
  final id = 'sh.room.$key';
  return [
    panel('$id.panel', placement: at(col, 3, colSpan: 4, rowSpan: 3), accent: accent),
    iconButton('$id.icon',
        icon: icon,
        placement: at(col, 3, colSpan: 1, rowSpan: 1),
        color: accent),
    label('$id.name',
        text: name,
        placement: at(col + 1, 3, colSpan: 3, rowSpan: 1),
        color: accent),
    gaugeCircular('$id.temp',
        placement: at(col, 4, colSpan: 4, rowSpan: 2),
        stateBinding: '$id.temp',
        sublabel: 'Temp',
        unit: '°C',
        min: 10,
        max: 35,
        color: accent),
  ];
}

/// A single Device-Control row: a [toggle] bound to the device state with a
/// leading control tile-style icon, laid out inside the Device Control panel.
/// 6 cols wide × 2 rows.
List<WidgetNode> _deviceToggle(
  String key,
  String name,
  String icon,
  String stateId,
  String action,
  String accent, {
  required int col,
  required int row,
}) {
  final id = 'sh.dev.$key';
  return [
    iconButton('$id.icon',
        icon: icon,
        placement: at(col, row, colSpan: 1, rowSpan: 1),
        color: accent),
    toggle('$id.toggle',
        placement: at(col + 1, row, colSpan: 5, rowSpan: 1),
        stateBinding: stateId,
        label: name,
        action: action,
        color: accent),
  ];
}

/// A security-camera thumbnail: a glass [panel] behind a camera icon + a name
/// label + a live "LIVE/offline" status stat row. 4 cols wide × 2 rows on row 7.
List<WidgetNode> _cameraThumb(
  String key,
  String name,
  String stateId, {
  required int col,
}) {
  final id = 'sh.cam.$key';
  return [
    panel('$id.panel', placement: at(col, 7, colSpan: 4, rowSpan: 1), accent: _green),
    iconButton('$id.icon',
        icon: 'camera',
        placement: at(col, 7, colSpan: 1, rowSpan: 1),
        color: _green),
    statRow('$id.status',
        label: name,
        placement: at(col + 1, 7, colSpan: 3, rowSpan: 1),
        stateBinding: stateId,
        color: _green),
  ];
}

// ── Mock state ids bound on this page (for Wave 2 to seed) ───────────────────
//  sys.clock                         -> "10:30 AM" (string)
//  home.weather.temp                 -> number °C (outside)
//  home.weather.humidity             -> number %
//  home.energy.now                   -> number watts (0–500, ring)
//  home.energy.today                 -> number kWh
//  home.energy.cost                  -> string e.g. "$3.20"
//  Rooms (gauge.circular, 10–35 °C):
//    sh.room.living.temp, sh.room.bedroom.temp, sh.room.kitchen.temp,
//    sh.room.office.temp, sh.room.bathroom.temp
//  Device toggles (bool):
//    home.lights.ceiling, home.lights.floor, home.tv, home.speaker,
//    home.ac, home.coffee
//  Automation toggle (bool): home.auto.sunset
//  Cameras (string status e.g. "LIVE"):
//    home.cam.front, home.cam.back, home.cam.garage
