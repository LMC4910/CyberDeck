/// Toggle widget (PROJ-182): a switch bound to a boolean state. It REFLECTS the
/// bound state (host authority — it does not flip locally) and emits its `tap`
/// interaction slot on toggle; the mapped action performs the actual state change,
/// which flows back as a state update. Honours `valueRules` for the accent.
library;

import 'package:flutter/material.dart';

import '../registry.dart';
import 'widget_theme.dart';

/// Builds a toggle from a render context (the registry builder).
Widget buildToggle(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final on = ctx.value == true;
  final label = node.appearance.style['label'] as String? ?? '';
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? node.appearance.style);

  return Row(
    key: Key('toggle-${node.id}'),
    mainAxisSize: MainAxisSize.min,
    children: [
      Switch(
        key: Key('toggle-switch-${node.id}'),
        value: on,
        activeThumbColor: accent,
        onChanged: (_) => ctx.emit('tap'),
      ),
      if (label.isNotEmpty)
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
    ],
  );
}
