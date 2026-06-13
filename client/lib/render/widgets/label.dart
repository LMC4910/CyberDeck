/// Label widget (PROJ-181 reference built-in, formalised in PROJ-183): renders
/// static text or a bound state value with presentation-side unit formatting
/// (ADR-0019 — units format here, not in the typed state). `valueRules` apply a
/// conditional accent.
///
/// Repainted on the CyberDeck design system (Wave 1, C1): the value reads in the
/// display face by default (a `style.font` role override is honoured) and a
/// matching `valueRules` style tints the text via the accent (status themes still
/// read as error/warn/ok). The rendered text + key are unchanged so it stays
/// editable and testable.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a label from a render context (the registry builder).
Widget buildLabel(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final label = style['label'] as String? ?? '';
  final unit = node.config['unit'] as String? ?? style['unit'] as String? ?? '';
  final valueText = formatLabelValue(ctx.value, unit);
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);

  // A matching rule tints the text with its resolved accent; otherwise text uses
  // the primary token (or a `style.color`/`style.theme` accent if authored).
  final hasRule = matched != null;
  final color = hasRule
      ? resolveAccent(matched, fallback: DeckColors.textPrimary)
      : resolveAccent(style, fallback: DeckColors.textPrimary);

  final text = label.isEmpty ? valueText : '$label: $valueText';
  return Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(
        text,
        key: Key('label-${node.id}'),
        textAlign: TextAlign.center,
        style: DeckType.forRole(
          style['font'] as String? ?? DeckFonts.display,
          color: color,
          fontWeight: hasRule ? FontWeight.w700 : FontWeight.w600,
        ),
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
