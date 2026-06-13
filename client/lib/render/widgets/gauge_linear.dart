/// Linear gauge / bar widget (PROJ-184): renders a scalar/percent state as a
/// horizontal fill with a value label, styled client-side by `valueRules`.
/// AC P1-AC-04 render. Registered as `gauge.linear` (alias `gauge.bar`).
///
/// Repainted on the CyberDeck design system (Wave 1, C1): a glassmorphic
/// [CardChrome] panel with an optional label, a big display-font value, and a
/// SEGMENTED neon bar — discrete cells that light cyan→purple (tinted toward the
/// value accent) up to the fill fraction over a faint track, with a soft glow.
/// All visuals derive from style/config + value, so it stays Designer-editable.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'gauge_common.dart';

/// Builds a linear gauge/bar from a render context (the registry builder).
///
/// BARE by default under the granularity model (no built-in [CardChrome]) so it
/// can sit on top of a [panel]; set `style.card:true` to re-enable its own card.
/// Per-widget accent comes via `style.color`/`style.theme`.
Widget buildLinearGauge(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final fraction = gaugeFraction(ctx.value, gaugeMin(node), gaugeMax(node));
  final accent = gaugeAccent(ctx.value, node);
  final label = node.appearance.style['label'] as String? ?? '';
  final valueText = formatValue(ctx.value, gaugeUnit(node));
  // Segment count is editable via config.segments (sane default + floor).
  final segments = ((node.config['segments'] as num?)?.toInt() ?? 20).clamp(4, 60);

  final body = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (label.isNotEmpty)
              Expanded(
                child: Text(
                  label,
                  key: Key('gauge-label-${node.id}'),
                  style: DeckType.sectionLabel(),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            Text(
              valueText,
              key: Key('gauge-value-${node.id}'),
              style: DeckType.display(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: accent,
                height: 1.0,
              ),
            ),
          ],
        ),
        const SizedBox(height: DeckSpacing.sm),
        SizedBox(
          height: 14,
          child: CustomPaint(
            size: const Size(double.infinity, 14),
            painter: _SegmentedBarPainter(
              fraction: fraction,
              accent: accent,
              segments: segments,
            ),
          ),
        ),
      ],
    );

  if (node.appearance.style['card'] == true) {
    return CardChrome(
      accent: accent,
      padding: const EdgeInsets.all(DeckSpacing.md),
      child: body,
    );
  }
  return body;
}

class _SegmentedBarPainter extends CustomPainter {
  _SegmentedBarPainter({
    required this.fraction,
    required this.accent,
    required this.segments,
  });

  final double fraction;
  final Color accent;
  final int segments;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    const gap = 3.0;
    final cellW = (size.width - gap * (segments - 1)) / segments;
    if (cellW <= 0) return;
    final radius = Radius.circular(math.min(3, cellW / 2));
    final litCount = (segments * fraction).round();

    for (var i = 0; i < segments; i++) {
      final x = i * (cellW + gap);
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, 0, cellW, size.height),
        radius,
      );
      final lit = i < litCount;
      if (lit) {
        final t = segments == 1 ? 0.0 : i / (segments - 1);
        final color = Color.lerp(
          Color.lerp(DeckColors.accentCyan, accent, 0.4)!,
          Color.lerp(DeckColors.accentPurple, accent, 0.4)!,
          t,
        )!;
        // Glow then crisp cell.
        canvas.drawRRect(
          rect,
          Paint()
            ..color = color.withValues(alpha: 0.55)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
        );
        canvas.drawRRect(rect, Paint()..color = color);
      } else {
        canvas.drawRRect(
          rect,
          Paint()..color = Colors.white.withValues(alpha: 0.07),
        );
      }
    }
  }

  @override
  bool shouldRepaint(_SegmentedBarPainter old) =>
      old.fraction != fraction ||
      old.accent != accent ||
      old.segments != segments;
}
