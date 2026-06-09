/// Label widget (PROJ-181 reference built-in, formalised in PROJ-183): renders
/// static text or a bound state value with presentation-side unit formatting
/// (ADR-0019 — units format here, not in the typed state). `valueRules` apply a
/// conditional accent.
library;

import 'package:flutter/material.dart';

import '../registry.dart';

/// Builds a label from a render context (the registry builder).
Widget buildLabel(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final label = node.appearance.style['label'] as String? ?? '';
  final unit = node.config['unit'] as String? ??
      node.appearance.style['unit'] as String? ??
      '';
  final valueText = formatLabelValue(ctx.value, unit);
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final isError = (matched?['theme'] as String?)?.contains('error') ?? false;

  final text = label.isEmpty ? valueText : '$label: $valueText';
  return Center(
    child: Text(
      text,
      key: Key('label-${node.id}'),
      style: TextStyle(
        color: isError ? Colors.redAccent : null,
        fontWeight: isError ? FontWeight.bold : FontWeight.normal,
      ),
    ),
  );
}

/// Formats a bound value with its unit: integers as-is, doubles to one decimal
/// (e.g. 42.0 → "42.0 °C"), null → "--". Unit formatting is presentation-side.
String formatLabelValue(Object? value, String unit) {
  if (value == null) return '--';
  final String s;
  if (value is int) {
    s = '$value';
  } else if (value is double) {
    s = value.toStringAsFixed(1);
  } else {
    s = '$value';
  }
  return unit.isEmpty ? s : '$s $unit';
}
