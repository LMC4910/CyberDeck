/// Built-in inspector schemas for the Wave 1 rich widgets (C2).
///
/// The schema-driven [Inspector] (PROJ-214) auto-generates editors from a list of
/// [ParamSchema]. In a live deck those schemas come from the engine registries
/// (PROJ-161); for the first-party rich widgets we also ship a static catalog so
/// they are editable the moment they are dropped — no per-widget UI code, just
/// the typed fields each widget reads from its `config`. The Designer can merge
/// these with (or fall back to) the registry-provided schema.
///
/// Keep the param `name`s in lock-step with the keys the matching builder reads
/// from `config` (and the `style`/`config` dual-read where noted), so an edit
/// here lands where the widget looks.
library;

import 'param_schema.dart';

/// The static inspector schema for a built-in [type], or an empty list when the
/// type has no first-party schema (the caller then falls back to inference /
/// registry data).
List<ParamSchema> builtinWidgetSchema(String type) {
  switch (type) {
    case 'launcher':
      return const [
        ParamSchema(name: 'label', type: ParamType.text, label: 'Label'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
        ParamSchema(name: 'asset', type: ParamType.text, label: 'Logo asset'),
      ];
    case 'media.player':
      return const [
        ParamSchema(name: 'track', type: ParamType.text, label: 'Track'),
        ParamSchema(name: 'artist', type: ParamType.text, label: 'Artist'),
        ParamSchema(name: 'albumArt', type: ParamType.text, label: 'Album art'),
      ];
    case 'status.list':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        // `items` is a structured list edited via the host/registry; surfaced
        // here as text so the field is at least visible/inspectable.
        ParamSchema(name: 'items', type: ParamType.text, label: 'Items (JSON)'),
      ];
    case 'metric.tile':
      return const [
        ParamSchema(name: 'label', type: ParamType.text, label: 'Label'),
        ParamSchema(name: 'unit', type: ParamType.text, label: 'Unit'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
        ParamSchema(name: 'value', type: ParamType.text, label: 'Value'),
      ];
    case 'section.header':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'trailing', type: ParamType.text, label: 'Trailing'),
      ];
    // Wave 0 granularity-model widgets.
    case 'panel':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'accent', type: ParamType.color, label: 'Accent'),
      ];
    case 'stat.row':
      return const [
        ParamSchema(name: 'label', type: ParamType.text, label: 'Label'),
        ParamSchema(name: 'value', type: ParamType.text, label: 'Value'),
        ParamSchema(name: 'unit', type: ParamType.text, label: 'Unit'),
      ];
    case 'control.tile':
      return const [
        ParamSchema(name: 'label', type: ParamType.text, label: 'Label'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
      ];
    case 'visualizer':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(
            name: 'bars', type: ParamType.integer, label: 'Bars', min: 3, max: 64),
      ];
    case 'ring':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'sublabel', type: ParamType.text, label: 'Sub-label'),
        ParamSchema(name: 'unit', type: ParamType.text, label: 'Unit'),
        ParamSchema(name: 'min', type: ParamType.number, label: 'Min'),
        ParamSchema(name: 'max', type: ParamType.number, label: 'Max'),
      ];
    case 'notification.item':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'body', type: ParamType.text, label: 'Body'),
        ParamSchema(name: 'time', type: ParamType.text, label: 'Time'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
      ];
    // Wave A composite cards: each card is ONE editor entity, so its title /
    // accent / items / series are edited as a unit here.
    case 'gauge.circular':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'sublabel', type: ParamType.text, label: 'Sub-label'),
        ParamSchema(name: 'unit', type: ParamType.text, label: 'Unit'),
        ParamSchema(name: 'min', type: ParamType.number, label: 'Min'),
        ParamSchema(name: 'max', type: ParamType.number, label: 'Max'),
        // `history` (numeric series) + `stats` {min,max,avg} feed the sparkline +
        // the Min/Max/Avg column; surfaced as text so they are at least editable.
        ParamSchema(name: 'history', type: ParamType.text, label: 'History (JSON)'),
        ParamSchema(name: 'stats', type: ParamType.text, label: 'Stats (JSON)'),
      ];
    case 'gauge.linear':
    case 'gauge.bar':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'label', type: ParamType.text, label: 'Label'),
        ParamSchema(name: 'unit', type: ParamType.text, label: 'Unit'),
        ParamSchema(name: 'min', type: ParamType.number, label: 'Min'),
        ParamSchema(name: 'max', type: ParamType.number, label: 'Max'),
        ParamSchema(
            name: 'segments', type: ParamType.integer, label: 'Segments', min: 4, max: 60),
      ];
    case 'slider':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'min', type: ParamType.number, label: 'Min'),
        ParamSchema(name: 'max', type: ParamType.number, label: 'Max'),
      ];
    case 'notification.list':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'items', type: ParamType.text, label: 'Items (JSON)'),
      ];
    case 'list.card':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'items', type: ParamType.text, label: 'Items (JSON)'),
      ];
    case 'room.card':
      return const [
        ParamSchema(name: 'name', type: ParamType.text, label: 'Room'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
        ParamSchema(name: 'temp', type: ParamType.text, label: 'Temperature'),
      ];
    case 'game.poster':
      return const [
        ParamSchema(name: 'title', type: ParamType.text, label: 'Title'),
        ParamSchema(name: 'subtitle', type: ParamType.text, label: 'Subtitle'),
        ParamSchema(name: 'art', type: ParamType.text, label: 'Art asset'),
      ];
    case 'mode.card':
      return const [
        ParamSchema(name: 'name', type: ParamType.text, label: 'Mode'),
        ParamSchema(name: 'description', type: ParamType.text, label: 'Description'),
        ParamSchema(name: 'icon', type: ParamType.text, label: 'Icon'),
      ];
    default:
      return const [];
  }
}

/// Whether [type] has a first-party inspector schema (Wave 1 rich widgets).
bool hasBuiltinWidgetSchema(String type) => builtinWidgetSchema(type).isNotEmpty;
