/// Schema-driven editor factory (PROJ-214, 2C §8.2). Maps a [ParamSchema] to the
/// right native editor — the single generic switch that makes the inspector
/// schema-driven: a new param type is the only place that needs a new case, and a
/// new *param* (of an existing type) needs no code at all.
library;

import 'package:flutter/material.dart';

import 'param_schema.dart';

/// Builds the editor widget for a parameter, wired to [value]/[onChanged].
Widget buildParamEditor({
  required ParamSchema schema,
  required Object? value,
  required ValueChanged<Object?> onChanged,
}) {
  switch (schema.type) {
    case ParamType.integer:
    case ParamType.number:
      if (schema.min != null && schema.max != null) {
        return _SliderEditor(schema: schema, value: value, onChanged: onChanged);
      }
      return _NumberFieldEditor(schema: schema, value: value, onChanged: onChanged);
    case ParamType.choice:
      return _ChoiceEditor(schema: schema, value: value, onChanged: onChanged);
    case ParamType.boolean:
      return _BoolEditor(schema: schema, value: value, onChanged: onChanged);
    case ParamType.color:
    case ParamType.text:
    case ParamType.unknown:
      return _TextFieldEditor(schema: schema, value: value, onChanged: onChanged);
    case ParamType.entity:
      return _EntityStubEditor(schema: schema);
  }
}

class _EditorShell extends StatelessWidget {
  const _EditorShell({required this.schema, required this.child});
  final ParamSchema schema;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: Key('editor-${schema.name}'),
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(schema.displayLabel)),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _SliderEditor extends StatelessWidget {
  const _SliderEditor({required this.schema, required this.value, required this.onChanged});
  final ParamSchema schema;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    final min = schema.min!.toDouble();
    final max = schema.max!.toDouble();
    final raw = value;
    final v = (raw is num ? raw : schema.min!).toDouble().clamp(min, max);
    return _EditorShell(
      schema: schema,
      child: Slider(
        key: Key('slider-${schema.name}'),
        min: min,
        max: max,
        value: v,
        onChanged: (d) =>
            onChanged(schema.type == ParamType.integer ? d.round() : d),
      ),
    );
  }
}

class _NumberFieldEditor extends StatelessWidget {
  const _NumberFieldEditor({required this.schema, required this.value, required this.onChanged});
  final ParamSchema schema;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return _EditorShell(
      schema: schema,
      child: TextFormField(
        key: Key('field-${schema.name}'),
        initialValue: value == null ? '' : '$value',
        keyboardType: TextInputType.number,
        onChanged: (s) {
          final n = schema.type == ParamType.integer
              ? int.tryParse(s)
              : num.tryParse(s);
          if (n != null) onChanged(n);
        },
      ),
    );
  }
}

class _ChoiceEditor extends StatelessWidget {
  const _ChoiceEditor({required this.schema, required this.value, required this.onChanged});
  final ParamSchema schema;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    final current = value is String && schema.choices.contains(value)
        ? value as String
        : (schema.choices.isNotEmpty ? schema.choices.first : null);
    return _EditorShell(
      schema: schema,
      child: DropdownButton<String>(
        key: Key('dropdown-${schema.name}'),
        isExpanded: true,
        value: current,
        items: [
          for (final c in schema.choices)
            DropdownMenuItem(value: c, child: Text(c)),
        ],
        onChanged: (c) {
          if (c != null) onChanged(c);
        },
      ),
    );
  }
}

class _BoolEditor extends StatelessWidget {
  const _BoolEditor({required this.schema, required this.value, required this.onChanged});
  final ParamSchema schema;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return _EditorShell(
      schema: schema,
      child: Align(
        alignment: Alignment.centerLeft,
        child: Switch(
          key: Key('switch-${schema.name}'),
          value: value == true,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

class _TextFieldEditor extends StatelessWidget {
  const _TextFieldEditor({required this.schema, required this.value, required this.onChanged});
  final ParamSchema schema;
  final Object? value;
  final ValueChanged<Object?> onChanged;

  @override
  Widget build(BuildContext context) {
    return _EditorShell(
      schema: schema,
      child: TextFormField(
        key: Key('field-${schema.name}'),
        initialValue: value == null ? '' : '$value',
        onChanged: onChanged,
      ),
    );
  }
}

class _EntityStubEditor extends StatelessWidget {
  const _EntityStubEditor({required this.schema});
  final ParamSchema schema;

  @override
  Widget build(BuildContext context) {
    // The entity picker is realised in Phase 4 (PROJ-4xx); a disabled stub keeps
    // the schema render complete without faking a picker.
    return _EditorShell(
      schema: schema,
      child: const Text('entity picker (Phase 4)',
          key: Key('entity-stub'), style: TextStyle(fontStyle: FontStyle.italic)),
    );
  }
}
