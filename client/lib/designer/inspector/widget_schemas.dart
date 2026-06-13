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
    default:
      return const [];
  }
}

/// Whether [type] has a first-party inspector schema (Wave 1 rich widgets).
bool hasBuiltinWidgetSchema(String type) => builtinWidgetSchema(type).isNotEmpty;
