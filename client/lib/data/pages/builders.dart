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

/// A 270° circular gauge COMPOSITE CARD (the prototype "CPU TEMPERATURE" card):
/// a single node drawing its own [CardChrome] with a small-caps [title], a Row of
/// [ ring (centre value + [sublabel]) | a Min/Max/Avg stat column ] and a
/// sparkline below. Binds to [stateBinding]; `min`/`max`/`unit` shape the value;
/// `color` sets the accent. The Min/Max/Avg + sparkline derive from [history] (a
/// numeric series) or an explicit [stats] `{min,max,avg}`. `card` defaults TRUE
/// (it represents a card); pass `card:false` for a bare ring on a [panel].
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
  bool card = true,
  List<num>? history,
  Map<String, num>? stats,
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
        'history': ?history,
        'stats': ?stats,
      },
    );

/// A segmented linear gauge/bar. As a titled COMPOSITE CARD (default `card:true`)
/// it draws its own [CardChrome] with a small-caps [title] over the labelled bar +
/// value. `label` shows above the bar; `segments` sets the cell count. Pass
/// `card:false` for a bare bar on a [panel]. Other keys mirror [gaugeCircular].
WidgetNode gaugeLinear(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? title,
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
          'title': ?title,
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
  String? param,
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
          'param': ?param,
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
  String? param,
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
        if (action != null)
          'tap': {'action': action, 'param': ?param},
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
      // The transport buttons drive the real media plugin (OS media keys); the
      // widget emits these slots and the engine routes them.
      interaction: const {
        'playPause': {'action': 'media.transport.playPause'},
        'next': {'action': 'media.transport.next'},
        'previous': {'action': 'media.transport.previous'},
      },
    );

/// A decorative animated VISUALIZER. As a titled COMPOSITE CARD (default
/// `card:true`) it draws its own [CardChrome] with a small-caps [title] over the
/// bar-box. `bars` sets the count; `color` the accent; binding to a `false` value
/// freezes it. Pass `card:false` for bare bars on a [panel].
WidgetNode visualizer(
  String id, {
  required Placement placement,
  String? stateBinding,
  String? title,
  int? bars,
  String? color,
  bool card = true,
}) =>
    WidgetNode(
      id: id,
      type: 'visualizer',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'title': ?title,
          'color': ?color,
          if (card) 'card': true,
        },
      ),
      config: {'bars': ?bars},
    );

/// A donut RING gauge COMPOSITE CARD with a centre value + optional [sublabel]
/// (health/storage). Default `card:true` draws its own titled [CardChrome]; pass
/// `card:false` for a bare ring on a [panel]. Other keys mirror [gaugeCircular].
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
  bool card = true,
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
  String? param,
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
        if (action != null)
          'tap': {'action': action, 'param': ?param},
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
  String? param,
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
        if (action != null)
          'tap': {'action': action, 'param': ?param},
      },
    );

/// A SLIDER bound to [stateBinding] within `min`/`max`; emits `dragValue`. Set
/// [vertical] for the volume-style vertical COMPOSITE CARD — a titled card (e.g.
/// [title] "Volume") with a vertical track + a `%` readout, all in one node.
/// `color` sets the accent.
WidgetNode slider(
  String id, {
  required Placement placement,
  String? stateBinding,
  num min = 0,
  num max = 100,
  bool vertical = false,
  String? title,
  String? action,
  String? param,
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
          'title': ?title,
          'color': ?color,
        },
      ),
      config: {'min': min, 'max': max},
      interaction: {
        if (action != null)
          'dragValue': {'action': action, 'param': ?param},
      },
    );

// ── Wave A composite cards ───────────────────────────────────────────────────
// Each builds a SINGLE composite-card node (its own chrome + all sub-content), so
// a card is one editor entity instead of a panel + decomposed parts.

/// A titled NOTIFICATION feed card (one node, replaces per-item nodes). [items]
/// are maps `{icon?, title, body?, time?, color?}` rendered as rows. `color` sets
/// the card accent. Type `notification.list`.
WidgetNode notificationList(
  String id, {
  required Placement placement,
  String? title,
  List<Map<String, dynamic>> items = const [],
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'notification.list',
      placement: placement,
      appearance: Appearance(style: {
        'title': ?title,
        'color': ?color,
      }),
      config: {'items': items},
    );

/// A generic titled LIST card (Top Processes / Recent Activity / Game Profiles /
/// Detailed Info). [items] are maps `{leading?, label, value?, trailing?, color?}`
/// where `leading`/`trailing` are deck-icon names. `color` sets the card accent.
/// Type `list.card`.
WidgetNode listCard(
  String id, {
  required Placement placement,
  String? title,
  List<Map<String, dynamic>> items = const [],
  String? color,
  String? stateBinding,
}) =>
    WidgetNode(
      id: id,
      type: 'list.card',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'title': ?title,
          'color': ?color,
        },
      ),
      config: {'items': items},
    );

/// A Smart-Home ROOM card — icon + [name] + [temp] readout + an on/off toggle
/// (one node). The toggle REFLECTS [stateBinding] and emits `tap` to [action].
/// `icon` is a deck-icon name; `color` sets the accent. Type `room.card`.
WidgetNode roomCard(
  String id, {
  required Placement placement,
  required String name,
  String? icon,
  String? temp,
  String? stateBinding,
  String? action,
  String? param,
  String? color,
  List<Map<String, dynamic>> valueRules = const [],
}) =>
    WidgetNode(
      id: id,
      type: 'room.card',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        valueRules: valueRules,
        style: {
          'name': name,
          'icon': ?icon,
          'temp': ?temp,
          'color': ?color,
        },
      ),
      interaction: {
        if (action != null)
          'tap': {'action': action, 'param': ?param},
      },
    );

/// A GAME poster card — box art ([art] asset, else a procedural gradient) +
/// [title] + an optional [subtitle], with a play/launch tap (one node). Tapping
/// emits `tap` to [action]. `color` sets the accent. Type `game.poster`.
WidgetNode gamePoster(
  String id, {
  required Placement placement,
  required String title,
  String? subtitle,
  String? art,
  String? action,
  String? param,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'game.poster',
      placement: placement,
      appearance: Appearance(style: {
        'title': title,
        'subtitle': ?subtitle,
        'art': ?art,
        'color': ?color,
      }),
      interaction: {
        if (action != null)
          'tap': {'action': action, 'param': ?param},
      },
    );

/// A performance-MODE card — icon + [name] + [description] + an ACTIVATE/active
/// button (one node). The active state REFLECTS [stateBinding]; tapping emits
/// `tap` to [action]. `icon` is a deck-icon name; `color` sets the accent.
/// Type `mode.card`.
WidgetNode modeCard(
  String id, {
  required Placement placement,
  required String name,
  String? description,
  String? icon,
  String? stateBinding,
  String? action,
  String? param,
  String? color,
}) =>
    WidgetNode(
      id: id,
      type: 'mode.card',
      placement: placement,
      appearance: Appearance(
        stateBinding: stateBinding,
        style: {
          'name': name,
          'description': ?description,
          'icon': ?icon,
          'color': ?color,
        },
      ),
      interaction: {
        if (action != null)
          'tap': {'action': action, 'param': ?param},
      },
    );
