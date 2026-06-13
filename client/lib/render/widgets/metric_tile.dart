/// Metric-tile widget (Wave 1 / C2): a compact glassmorphic stat card — a small
/// accent icon, a big display numeral with a muted unit, and a muted caption
/// label beneath. Designed for a wall of telemetry tiles (CPU %, temp, FPS…).
///
/// Data-driven: the headline value follows the bound `stateBinding` (host
/// authority) and falls back to `config.value` / `style.value`, showing "--"
/// when nothing is bound yet. `style.unit`, `style.label`/`config.label`, and
/// `style.icon` decorate it; `valueRules` can swap the accent by threshold (e.g.
/// turn red over 85). Registered as `metric.tile`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a metric tile from a render context (the registry builder).
Widget buildMetricTile(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? style);

  final label = style['label'] as String? ?? node.config['label'] as String? ?? '';
  final unit = style['unit'] as String? ?? node.config['unit'] as String? ?? '';
  final iconName = style['icon'] as String? ?? node.config['icon'] as String?;
  final value = _displayValue(ctx.value, style, node.config);

  return CardChrome(
    key: Key('metric-tile-${node.id}'),
    accent: accent,
    padding: const EdgeInsets.all(DeckSpacing.md),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (iconName != null)
          Container(
            padding: const EdgeInsets.all(DeckSpacing.xs),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(DeckSpacing.radius),
            ),
            child: Icon(deckIcon(iconName), color: accent, size: 18),
          ),
        const SizedBox(height: DeckSpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: Text(
                value,
                key: Key('metric-value-${node.id}'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DeckType.display(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: DeckColors.textPrimary,
                  height: 1.0,
                ),
              ),
            ),
            if (unit.isNotEmpty) ...[
              const SizedBox(width: DeckSpacing.xs),
              Text(
                unit,
                key: Key('metric-unit-${node.id}'),
                style: DeckType.mono(fontSize: 12, color: DeckColors.textSecondary),
              ),
            ],
          ],
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(height: DeckSpacing.xs),
          Text(
            label.toUpperCase(),
            key: Key('metric-label-${node.id}'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DeckType.sectionLabel(),
          ),
        ],
      ],
    ),
  );
}

/// The headline string: the bound value if present, else a `value` default from
/// config/style, else "--" (never fabricated when unbound).
String _displayValue(
  Object? value,
  Map<String, dynamic> style,
  Map<String, dynamic> config,
) {
  if (value != null) {
    if (value is num) {
      // Trim a trailing ".0" so integers read clean; keep one decimal otherwise.
      return value == value.roundToDouble()
          ? value.toInt().toString()
          : value.toStringAsFixed(1);
    }
    final s = '$value';
    if (s.isNotEmpty) return s;
  }
  final fallback = config['value'] ?? style['value'];
  if (fallback != null && '$fallback'.isNotEmpty) return '$fallback';
  return '--';
}
