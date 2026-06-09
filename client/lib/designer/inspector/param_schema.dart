/// Parameter schema for the schema-driven inspector (PROJ-214, 2C §8.2 / ADR-0006).
/// The engine's registries (PROJ-161) describe each widget config field / action
/// param as a typed parameter; the inspector reads these and auto-generates the
/// right editor — so a brand-new plugin action with a `choice` param gets a working
/// dropdown with NO designer code change (the keystone payoff, AC P1-AC-10).
library;

/// The kinds of parameter the inspector knows how to edit.
enum ParamType {
  integer,
  number,
  choice,
  boolean,
  text,
  color,
  entity, // picker is a Phase-4 stub in V1
  unknown,
}

/// One typed, editable parameter.
class ParamSchema {
  const ParamSchema({
    required this.name,
    required this.type,
    this.label,
    this.min,
    this.max,
    this.choices = const [],
    this.defaultValue,
  });

  final String name;
  final ParamType type;
  final String? label;
  final num? min;
  final num? max;
  final List<String> choices;
  final Object? defaultValue;

  /// The display label (falls back to the param name).
  String get displayLabel => label ?? name;

  factory ParamSchema.fromJson(Map<String, dynamic> m) => ParamSchema(
        name: m['name'] as String,
        type: parseParamType(m['type'] as String?),
        label: m['label'] as String?,
        min: m['min'] as num?,
        max: m['max'] as num?,
        choices: (m['choices'] as List?)?.map((e) => '$e').toList() ?? const [],
        defaultValue: m['default'],
      );
}

/// Maps a registry param `type` string to a [ParamType] (tolerant of synonyms).
ParamType parseParamType(String? type) {
  switch (type) {
    case 'int':
    case 'integer':
      return ParamType.integer;
    case 'number':
    case 'float':
    case 'double':
      return ParamType.number;
    case 'choice':
    case 'enum':
      return ParamType.choice;
    case 'bool':
    case 'boolean':
      return ParamType.boolean;
    case 'text':
    case 'string':
      return ParamType.text;
    case 'color':
      return ParamType.color;
    case 'entity':
      return ParamType.entity;
    default:
      return ParamType.unknown;
  }
}
