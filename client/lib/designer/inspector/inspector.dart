/// Schema-driven inspector panel (PROJ-214, 2C §8.2 / ADR-0006). Given the selected
/// widget and its parameter schema (from the registries, PROJ-161), it
/// auto-generates the editors and commits each edit as a `SetConfig` op (PROJ-211)
/// — which broadcasts and reflects live (PROJ-212). No per-action/per-widget UI
/// code: a new param type is the only thing that ever needs new code (AC P1-AC-10).
library;

import 'package:flutter/material.dart';

import '../../render/render.dart';
import '../op_model.dart';
import 'editor_factory.dart';
import 'param_schema.dart';

/// The inspector for one selected widget.
class Inspector extends StatelessWidget {
  const Inspector({
    super.key,
    required this.widget,
    required this.schema,
    required this.opBuilder,
    required this.onCommit,
  });

  /// The selected widget.
  final WidgetNode widget;

  /// The parameter schema for this widget's config (+ its action's params).
  final List<ParamSchema> schema;

  /// Builds the ops emitted on edit.
  final OpBuilder opBuilder;

  /// Receives the op for each committed edit (the Designer sends it to the engine
  /// and applies it optimistically).
  final void Function(Map<String, dynamic> op) onCommit;

  @override
  Widget build(BuildContext context) {
    if (schema.isEmpty) {
      return const Center(
        child: Text('No editable parameters', key: Key('inspector-empty')),
      );
    }
    return ListView(
      key: const Key('inspector'),
      shrinkWrap: true,
      children: [
        for (final param in schema)
          buildParamEditor(
            schema: param,
            value: widget.config[param.name] ?? param.defaultValue,
            onChanged: (v) => _commit(param, v),
          ),
      ],
    );
  }

  void _commit(ParamSchema param, Object? value) {
    final config = {...widget.config, param.name: value};
    onCommit(opBuilder.setConfig(widget.id, config));
  }
}
