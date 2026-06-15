/// Smart Home page (Wave B — ONE WIDGET = ONE ENTITY rewrite) — a cyberpunk
/// "command center" for the home: a Rooms overview strip, Device Control toggles,
/// Scenes & Automations tiles, an Energy Monitor, Security Camera tiles, an
/// environment strip and a Recent Activity feed.
///
/// Authored under the SINGLE-COMPOSITE-NODE model: every visual CARD is ONE
/// composite widget node that draws its OWN card chrome + all its sub-content
/// (so the Designer treats a card as a single entity). No card is a `panel` +
/// decomposed parts anymore. Individual CONTROLS (toggles, control tiles) that
/// already are single entities stay one node each, grouped on a backing panel
/// purely as a control surface.
///
/// Composed on a 24×16 grid. Nothing hardcodes palette literals beyond the named
/// accent consts; all live values bind to mock state ids (footer list).
/// Export: [smartHomePage].
library;

import '../../render/model.dart';
import 'builders.dart';

// Accent palette (token hexes from theme/tokens.dart — kept as named consts so
// the page reads cleanly and the Designer still sees plain `#RRGGBB` values).
const String _cyan = '#00B4D8';
const String _purple = '#7B2FBE';
const String _green = '#00E676';
const String _amber = '#FFAB40';

/// The Smart Home layout: a grid of single-composite cards + individual controls.
LayoutPage smartHomePage() {
  return LayoutPage(
    id: 'smart_home',
    grid: const GridConfig(columns: 24, rows: 16),
    widgets: [
      ..._header(),
      ..._environment(),
      ..._rooms(),
      ..._cameras(),
      ..._deviceControl(),
      ..._scenes(),
      ..._energy(),
      ..._activity(),
    ],
  );
}

// ──────────────────────────────────────────────────────────────────────────
// PAGE HEADER — title + subtitle (left), live clock + date (right). Labels are
// already single entities; not cards.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _header() => [
      // Title/subtitle are pure static captions; a bare label renders a
      // "prefix: value" pair, so author the static-only ones via section.header
      // and a binding-only label (no static prefix) for the live clock/date.
      sectionHeader('sh.header.title',
          placement: at(0, 0, colSpan: 12, rowSpan: 1),
          title: 'Smart Home',
          color: _cyan),
      sectionHeader('sh.header.sub',
          placement: at(0, 1, colSpan: 12, rowSpan: 1),
          title: 'Control and monitor your home environment',
          color: '#8E92C4'),
      label('sh.header.clock',
          placement: at(20, 0, colSpan: 4, rowSpan: 1),
          stateBinding: 'sys.clock',
          font: 'mono',
          color: _cyan),
      label('sh.header.date',
          placement: at(20, 1, colSpan: 4, rowSpan: 1),
          stateBinding: 'sys.date',
          font: 'mono',
          color: '#8E92C4'),
    ];

// ──────────────────────────────────────────────────────────────────────────
// ENVIRONMENT — one composite list card (top-right) of the outdoor/indoor
// readings: Temperature / Humidity / Air Quality / CO₂. Replaces the old
// panel + per-row stat clusters.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _environment() => [
      listCard('sh.env.card',
          placement: at(20, 2, colSpan: 4, rowSpan: 4),
          title: 'Environment',
          color: _cyan,
          items: const [
            {
              'leading': 'temp',
              'label': 'Temperature',
              'value': '24°C',
              'color': _cyan,
            },
            {
              'leading': 'temp',
              'label': 'Humidity',
              'value': '45%',
              'color': _purple,
            },
            {
              'leading': 'check',
              'label': 'Air Quality',
              'value': 'Good',
              'color': _green,
            },
            {
              'leading': 'bolt',
              'label': 'CO₂ Level',
              'value': '420 ppm',
              'color': _amber,
            },
          ]),
    ];

// ──────────────────────────────────────────────────────────────────────────
// ROOMS OVERVIEW — five single-composite room cards (icon + name + temp + an
// on/off toggle, all in ONE node each). Replaces the old panel + icon + name +
// gauge clusters.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _rooms() {
  final rooms = <Map<String, String>>[
    {'key': 'living', 'name': 'Living Room', 'icon': 'light', 'color': _cyan},
    {'key': 'bedroom', 'name': 'Bedroom', 'icon': 'home', 'color': _purple},
    {'key': 'kitchen', 'name': 'Kitchen', 'icon': 'bolt', 'color': _amber},
    {'key': 'office', 'name': 'Office', 'icon': 'cpu', 'color': _cyan},
    {'key': 'bathroom', 'name': 'Bathroom', 'icon': 'temp', 'color': _purple},
  ];

  return [
    sectionHeader('sh.rooms.head',
        title: 'Rooms Overview',
        placement: at(0, 2, colSpan: 19, rowSpan: 1),
        trailing: 'VIEW ALL',
        rule: true,
        color: _cyan),
    for (var i = 0; i < rooms.length; i++)
      roomCard('sh.room.${rooms[i]['key']}',
          placement: at(i * 4, 3, colSpan: 4, rowSpan: 2),
          name: rooms[i]['name']!,
          icon: rooms[i]['icon']!,
          temp: '22°C',
          stateBinding: 'home.room.${rooms[i]['key']}',
          action: 'home.room.${rooms[i]['key']}.toggle',
          color: rooms[i]['color']!),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// SECURITY CAMERAS — one composite list card of camera feeds (Front Door /
// Driveway / Backyard / Garage), each a row with a live LIVE/offline status.
// Replaces the old per-thumb panel + icon + stat clusters.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _cameras() => [
      listCard('sh.cams.card',
          placement: at(0, 5, colSpan: 19, rowSpan: 3),
          title: 'Security Cameras',
          color: _green,
          items: const [
            {
              'leading': 'camera',
              'label': 'Front Door',
              'value': 'LIVE',
              'color': _green,
            },
            {
              'leading': 'camera',
              'label': 'Driveway',
              'value': 'LIVE',
              'color': _green,
            },
            {
              'leading': 'camera',
              'label': 'Backyard',
              'value': 'LIVE',
              'color': _green,
            },
            {
              'leading': 'camera',
              'label': 'Garage',
              'value': 'LIVE',
              'color': _green,
            },
          ]),
    ];

// ──────────────────────────────────────────────────────────────────────────
// DEVICE CONTROL — a backing panel as a CONTROL SURFACE holding individual
// toggle controls. Each toggle is already a SINGLE editor entity (an individual
// control, not a card), so they stay one node each per the granularity rules.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _deviceControl() {
  final devices = <Map<String, String>>[
    {'key': 'lights', 'name': 'Ceiling Lights', 'state': 'home.lights.ceiling', 'color': _amber},
    {'key': 'floor', 'name': 'Floor Lamp', 'state': 'home.lights.floor', 'color': _amber},
    {'key': 'tv', 'name': 'Smart TV', 'state': 'home.tv', 'color': _purple},
    {'key': 'speaker', 'name': 'Speaker', 'state': 'home.speaker', 'color': _cyan},
    {'key': 'ac', 'name': 'AC Unit', 'state': 'home.ac', 'color': _cyan},
    {'key': 'coffee', 'name': 'Coffee Maker', 'state': 'home.coffee', 'color': _amber},
  ];

  return [
    panel('sh.devices.panel',
        placement: at(0, 8, colSpan: 13, rowSpan: 8),
        title: 'Device Control',
        accent: _cyan),
    for (var i = 0; i < devices.length; i++)
      toggle('sh.dev.${devices[i]['key']}',
          placement:
              at(1 + (i % 2) * 6, 9 + (i ~/ 2) * 2, colSpan: 5, rowSpan: 2),
          stateBinding: devices[i]['state'],
          label: devices[i]['name'],
          action: '${devices[i]['state']}.toggle',
          color: devices[i]['color']),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// SCENES & AUTOMATIONS — a backing panel as a CONTROL SURFACE holding individual
// scene control tiles + an automation toggle (each already a single entity).
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _scenes() {
  final scenes = <Map<String, String>>[
    {'key': 'goodnight', 'label': 'Good Night', 'icon': 'home', 'color': _purple},
    {'key': 'movie', 'label': 'Movie Time', 'icon': 'app', 'color': _cyan},
    {'key': 'party', 'label': 'Party Mode', 'icon': 'star', 'color': _amber},
    {'key': 'focus', 'label': 'Work Focus', 'icon': 'cpu', 'color': _cyan},
    {'key': 'morning', 'label': 'Morning', 'icon': 'bolt', 'color': _amber},
    {'key': 'away', 'label': 'Away', 'icon': 'power', 'color': _purple},
  ];

  return [
    panel('sh.scenes.panel',
        placement: at(13, 8, colSpan: 7, rowSpan: 8),
        title: 'Scenes & Automations',
        accent: _purple),
    for (var i = 0; i < scenes.length; i++)
      controlTile('sh.scene.${scenes[i]['key']}',
          label: scenes[i]['label']!,
          icon: scenes[i]['icon']!,
          action: 'home.scene.${scenes[i]['key']}',
          placement:
              at(14 + (i % 3) * 2, 9 + (i ~/ 3) * 2, colSpan: 2, rowSpan: 2),
          color: scenes[i]['color']),
    sectionHeader('sh.scenes.auto',
        title: 'Automations',
        placement: at(14, 13, colSpan: 5, rowSpan: 1),
        trailing: '4 ACTIVE',
        color: _green),
    toggle('sh.auto.sunset',
        placement: at(14, 14, colSpan: 5, rowSpan: 1),
        stateBinding: 'home.auto.sunset',
        label: 'Sunset lights',
        action: 'home.auto.sunset.toggle',
        color: _amber),
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// ENERGY MONITOR — ONE composite circular-gauge card (its own chrome + ring +
// Today/Cost stats + sparkline derived from history). Replaces the old panel +
// ring + stat-row cluster.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _energy() => [
      gaugeCircular('sh.energy.card',
          placement: at(20, 6, colSpan: 4, rowSpan: 4),
          stateBinding: 'home.energy.now',
          title: 'Energy Monitor',
          sublabel: 'Watts now',
          unit: ' W',
          min: 0,
          max: 500,
          color: _green,
          history: const [
            120, 180, 150, 210, 260, 230, 300, 280, 340, 156, 190, 156
          ],
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
    ];

// ──────────────────────────────────────────────────────────────────────────
// RECENT ACTIVITY — ONE composite notification-feed card (far right). Replaces
// the old status-list / per-item nodes with a single notification.list node.
// ──────────────────────────────────────────────────────────────────────────
List<WidgetNode> _activity() => [
      notificationList('sh.activity.card',
          placement: at(20, 10, colSpan: 4, rowSpan: 6),
          title: 'Recent Activity',
          color: _cyan,
          items: const [
            {
              'icon': 'check',
              'title': 'Front door unlocked',
              'body': 'Smart lock · Hallway',
              'time': '2m',
              'color': _green,
            },
            {
              'icon': 'light',
              'title': 'Living room lights on',
              'body': 'Scene · Evening',
              'time': '14m',
              'color': _amber,
            },
            {
              'icon': 'camera',
              'title': 'Motion: Backyard',
              'body': 'Camera · Detected movement',
              'time': '31m',
              'color': _amber,
            },
            {
              'icon': 'temp',
              'title': 'Thermostat set to 22°C',
              'body': 'Climate · Auto',
              'time': '1h',
              'color': _cyan,
            },
            {
              'icon': 'home',
              'title': 'Good Night scene ran',
              'body': 'Automation · Schedule',
              'time': '8h',
              'color': _purple,
            },
          ]),
    ];

// ── Mock state ids bound on this page (for Wave 2 to seed) ───────────────────
//  sys.clock                         -> "10:30 AM" (string)
//  sys.date                          -> "May 15, 2024" (string)
//  home.energy.now                   -> number watts (0–500, gauge)
//  Rooms (bool on/off; temp shown statically per card):
//    home.room.living, home.room.bedroom, home.room.kitchen,
//    home.room.office, home.room.bathroom
//  Device toggles (bool):
//    home.lights.ceiling, home.lights.floor, home.tv, home.speaker,
//    home.ac, home.coffee
//  Automation toggle (bool): home.auto.sunset
