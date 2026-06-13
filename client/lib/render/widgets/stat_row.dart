/// Stat-row widget (Wave 0 / granularity model): a compact single line — a muted
/// label on the left, a bright value on the right — for the Min/Max/Avg,
/// Used/Free/Total and status lines that flank the gauges in prototype.html.
///
/// It is a BARE widget (no card chrome): drop several on top of a [panel] to form
/// the stat column beside a gauge ring. Data-driven: `config.label`/`style.label`
/// for the muted left text, and the right value from the bound state, else
/// `config.value`/`style.value`. `style.unit` is appended; `valueRules` (or a
/// `style.color`/`style.theme`) tints the value. Registered as `stat.row`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a stat row from a render context (the registry builder).
Widget buildStatRow(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final config = node.config;

  final label =
      (style['label'] as String? ?? config['label'] as String? ?? '').trim();
  final unit = style['unit'] as String? ?? config['unit'] as String? ?? '';

  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  // A matching rule tints the value; else use an authored color/theme, else the
  // bright primary text token (this is a value, not an accent fill).
  final valueColor = matched != null
      ? resolveAccent(matched, fallback: DeckColors.textPrimary)
      : resolveAccent(style, fallback: DeckColors.textPrimary);

  final value = _displayValue(ctx.value, style, config, unit);

  return Row(
    key: Key('stat-row-${node.id}'),
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Flexible(
        child: Text(
          label,
          key: Key('stat-label-${node.id}'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: DeckType.body(fontSize: 12, color: DeckColors.textSecondary),
        ),
      ),
      const SizedBox(width: DeckSpacing.sm),
      Text(
        value,
        key: Key('stat-value-${node.id}'),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: DeckType.mono(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: valueColor,
        ),
      ),
    ],
  );
}

/// The right-hand value string: the bound value if present (numbers trimmed),
/// else `config.value`/`style.value`, else "--" — with [unit] appended.
String _displayValue(
  Object? value,
  Map<String, dynamic> style,
  Map<String, dynamic> config,
  String unit,
) {
  String? text;
  if (value != null) {
    if (value is num) {
      text = value == value.roundToDouble()
          ? value.toInt().toString()
          : value.toStringAsFixed(1);
    } else {
      final s = '$value';
      if (s.isNotEmpty) text = s;
    }
  }
  text ??= () {
    final fallback = config['value'] ?? style['value'];
    return (fallback != null && '$fallback'.isNotEmpty) ? '$fallback' : null;
  }();
  if (text == null) return '--';
  return unit.isEmpty ? text : '$text$unit';
}
