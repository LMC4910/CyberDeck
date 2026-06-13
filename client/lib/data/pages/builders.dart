/// Shared node-builder helpers (Wave 0) — pure functions returning a [WidgetNode]
/// for each widget type, so the page authors (later waves) compose consistent,
/// conflict-free pages WITHOUT hand-writing style/config maps. Each helper
/// MIRRORS the exact `style`/`config`/`interaction` keys the matching registry
/// builder reads (see `lib/render/widgets/*`), under the granularity model:
///
///   * a `panel` is placed FIRST (so the interpreter paints it BEHIND), then
///   * small BARE widgets (gauge ring, stat rows, sparkline, labels, icons,
///     control tiles) are placed AFTER (on top), each individually editable.
///
/// These are deliberately thin: they only build the descriptor, never any
/// visuals. Keep the keys here in lock-step with the builders + inspector
/// schemas so a Designer edit lands where the widget looks.
library;

import '../../render/model.dart';

/// A shorthand for a [Placement] at ([col],[row]) spanning [colSpan]×[rowSpan].
Placement at(int col, int row, {int colSpan = 1, int rowSpan = 1}) =>
    Placement(col: col, row: row, colSpan: colSpan, rowSpan: rowSpan);

/// A glass PANEL background (granularity model): place this FIRST so it paints
/// behind a cluster of bare widgets. `title` adds a small-caps header; `accent`
/// is a `#RRGGBB`/token tint for the glow; `glow:false` drops the halo.
WidgetNode panel(
  String id, {
  required Placement placement,
  String? title,
  String? accent,
  bool glow = true,
}) =>
    WidgetNode(
      id: id,
      type: 'panel',
      placement: placement,
      appearance: Appearance(style: {
        'title': ?title,
        'accent': ?accent,
        if (!glow) 'glow': false,
      }),
    );

/// A 270° circular gauge (BARE by default). Binds to [stateBinding]; `min`/`max`/
/// `unit` shape the value; `sublabel` rides via style; `color` sets the accent;
/// `card:true` re-enables the gauge's own [CardChrome]; `title` labels that card.
WidgetNode gaugeCircular(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? title,
  String? sublabel,
  String? unit,
  num min = 0,
  num max = 100,
  String? color,
  bool card = false,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'gauge.circular',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'title': ?title,
          'sublabel': ?sublabel,
          'color': ?color,
          if (card) 'card': true,
        },
      ),
      config: {
        'min': min,
        'max': max,
        'unit': ?unit,
      },
    );

/// A segmented linear gauge/bar (BARE by default). `label` shows above the bar;
/// `segments` sets the cell count; other keys mirror [gaugeCircular].
WidgetNode gaugeLinear(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? label,
  String? unit,
  num min = 0,
  num max = 100,
  int? segments,
  String? color,
  bool card = false,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'gauge.linear',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'label': ?label,
          'color': ?color,
          if (card) 'card': true,
        },
      ),
      config: {
        'min': min,
        'max': max,
        'unit': ?unit,
        'segments': ?segments,
      },
    );

/// A neon SPARKLINE trace (BARE by default). Binds to a series/scalar state;
/// `capacity` is the rolling-window length; `card:true` wraps it; `title` labels
/// that card.
WidgetNode sparkline(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? color,
  int? capacity,
  bool card = false,
  String? title,
}) =>
    WidgetNode(
      id: id,
      type: 'sparkline',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'color': ?color,
          if (card) 'card': true,
          'title': ?title,
        },
      ),
      config: {'capacity': ?capacity},
    );

/// A compact STAT row — muted [label] left, bright value right (Min/Max/Avg,
/// Used/Free/Total, status lines). A static value goes in [value]; a live one
/// binds via [stateBinding]; `unit` is appended; `color` tints the value.
WidgetNode statRow(
  String id, {
  required String label,
  String? value,
  required Placement placement,
  String? stateBinding,
  String? unit,
  String? color,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'stat.row',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'label': label,
          'value': ?value,
          'unit': ?unit,
          'color': ?color,
        },
      ),
    );

/// A small SQUARE control tile — [icon] above [label] — that emits its `tap`
/// slot to [action] (a confirm gesture can be requested via [confirm], surfaced
/// to PROJ-187). `color` sets the accent.
WidgetNode controlTile(
  String id, {
  required String label,
  required String icon,
  required String action,
  required Placement placement,
  String? color,
  bool confirm = false,
}) =>
    WidgetNode(
      id: id,
      type: 'control.tile',
      placement: placement,
      appearance: Appearance(style: {
        'label': label,
        'icon': icon,
        'color': ?color,
      }),
      interaction: {
        'tap': {
          'action': action,
          if (confirm) 'confirm': true,
        },
      },
    );

/// An app/shortcut LAUNCHER tile — a square art face above [label]. `icon`
/// (deck-icon name) or `asset` (logo image) paints the face; tapping emits `tap`
/// to [action]. `color` tints the procedural fallback.
WidgetNode launcher(
  String id, {
  required String label,
  required Placement placement,
  String? icon,
  String? asset,
  String? action,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'launcher',
      placement: placement,
      appearance: Appearance(style: {
        'label': label,
        'icon': ?icon,
        'asset': ?asset,
        'color': ?color,
      }),
      interaction: {
        if (action != null) 'tap': {'action': action},
      },
    );

/// The rich MEDIA PLAYER panel. Binds to a `media.*` state (Map with
/// `track`/`artist`/`playing`/`progress`/`elapsed`/`duration`); `track`/`artist`
/// give a static preview; `albumArt` paints the art; `color` sets the accent.
/// The transport buttons emit `previous`/`playPause`/`next`/`shuffle`/`repeat`.
WidgetNode mediaPlayer(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? track,
  String? artist,
  String? albumArt,
  num? duration,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'media.player',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'track': ?track,
          'artist': ?artist,
          'albumArt': ?albumArt,
          'duration': ?duration,
          'color': ?color,
        },
      ),
    );

/// A decorative animated VISUALIZER bar-box. `bars` sets the count; `color` the
/// accent; `card:true` wraps it; binding to a `false` value freezes it.
WidgetNode visualizer(
  String id, {
  required Placement placement,
  String? stateBinding,
  int? bars,
  String? color,
  bool card = false,
}) =>
    WidgetNode(
      id: id,
      type: 'visualizer',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'color': ?color,
          if (card) 'card': true,
        },
      ),
      config: {'bars': ?bars},
    );

/// A donut RING gauge with a centre value + optional [sublabel] (health/storage).
/// BARE by default; `card:true` wraps it. Other keys mirror [gaugeCircular].
WidgetNode ring(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? sublabel,
  String? unit,
  String? title,
  num min = 0,
  num max = 100,
  String? color,
  bool card = false,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'ring',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'sublabel': ?sublabel,
          'title': ?title,
          'color': ?color,
          if (card) 'card': true,
        },
      ),
      config: {
        'min': min,
        'max': max,
        'unit': ?unit,
      },
    );

/// A titled STATUS list card — rows of leading icon + muted label + bright value.
/// [items] are maps like `{label, value, icon?, color?}`.
WidgetNode statusList(
  String id, {
  required Placement placement,
  String? title,
  List<Map<String, dynamic>> items = const [],
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'status.list',
      placement: placement,
      appearance: Appearance(style: {
        'title': ?title,
        'color': ?color,
      }),
      config: {'items': items},
    );

/// One NOTIFICATION item — leading [icon], [title] + [body], trailing [time].
/// BARE by default; `card:true` wraps it. `color` tints the icon chip.
WidgetNode notificationItem(
  String id, {
  required Placement placement,
  String? title,
  String? body,
  String? time,
  String? icon,
  String? color,
  bool card = false,
}) =>
    WidgetNode(
      id: id,
      type: 'notification.item',
      placement: placement,
      appearance: Appearance(style: {
        'title': ?title,
        'body': ?body,
        'time': ?time,
        'icon': ?icon,
        'color': ?color,
        if (card) 'card': true,
      }),
    );

/// A round ICON BUTTON tile (the `button` widget with a leading [icon]). Emits
/// `tap` to [action]. `label` is optional; `color` sets the accent.
WidgetNode iconButton(
  String id, {
  required String icon,
  required Placement placement,
  String? label,
  String? action,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'button',
      placement: placement,
      appearance: Appearance(style: {
        'icon': icon,
        'label': ?label,
        'color': ?color,
      }),
      interaction: {
        if (action != null) 'tap': {'action': action},
      },
    );

/// A static or bound LABEL. [text] is the static caption; bind a live value via
/// [stateBinding]; `unit`/`font`/`color` shape it.
WidgetNode label(
  String id, {
  required Placement placement,
  String? text,
  String? stateBinding,
  String? unit,
  String? font,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'label',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'label': ?text,
          'unit': ?unit,
          'font': ?font,
          'color': ?color,
        },
      ),
    );

/// A small-caps SECTION HEADER between cards. [title] is upper-cased; `trailing`
/// shows a bright accent value; `rule:true` underlines it; `color` the accent.
WidgetNode sectionHeader(
  String id, {
  required String title,
  required Placement placement,
  String? trailing,
  bool rule = false,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'section.header',
      placement: placement,
      appearance: Appearance(style: {
        'title': title,
        'trailing': ?trailing,
        if (rule) 'rule': true,
        'color': ?color,
      }),
    );

/// A boolean TOGGLE bound to [stateBinding]; emits `tap` to [action]. `label`
/// captions it; `color` sets the on-accent.
WidgetNode toggle(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? label,
  String? action,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'toggle',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'label': ?label,
          'color': ?color,
        },
      ),
      interaction: {
        if (action != null) 'tap': {'action': action},
      },
    );

/// A SLIDER bound to [stateBinding] within `min`/`max`; emits `dragValue`. Set
/// [vertical] for the volume-style vertical slider; `color` sets the accent.
WidgetNode slider(
  String id, {
  required Placement placement,
  String? stateBinding,
  num min = 0,
  num max = 100,
  bool vertical = false,
  String? action,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'slider',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          if (vertical) 'orientation': 'vertical',
          'color': ?color,
        },
      ),
      config: {'min': min, 'max': max},
      interaction: {
        if (action != null) 'dragValue': {'action': action},
      },
    );
