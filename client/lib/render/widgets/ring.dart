/// Ring / donut gauge widget (Wave 0 / granularity model): a FULL 360° filled
/// ring with a big centre value (and optional small sublabel) — for health,
/// storage and capacity readouts (the donut feel distinct from the 270° arc of
/// `gauge.circular`). The ring fills clockwise from the top to the value
/// fraction, glowing cyan→purple (tinted toward the value accent) over a faint
/// track.
///
/// BARE by default (no card chrome) so it can sit on top of a [panel]; set
/// `style.card:true` to wrap it. Data-driven: bound numeric value within
/// `config.min`/`config.max`, `config.unit`, `style.sublabel`, `style.color`/
/// `style.theme` accent, `valueRules` for threshold tints. Registered as `ring`.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'gauge_common.dart';

/// Builds a donut/ring gauge from a render context (the registry builder).
Widget buildRing(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final fraction = gaugeFraction(ctx.value, gaugeMin(node), gaugeMax(node));
  final accent = gaugeAccent(ctx.value, node);
  final valueText = formatValue(ctx.value, gaugeUnit(node));
  final sublabel = style['sublabel'] as String?;

  Widget body = LayoutBuilder(
    builder: (context, constraints) {
      return CustomPaint(
        painter: _RingPainter(fraction: fraction, accent: accent),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(DeckSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    valueText,
                    key: Key('ring-value-${node.id}'),
                    style: DeckType.display(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: DeckColors.textPrimary,
                      height: 1.0,
                    ),
                  ),
                ),
                if (sublabel != null && sublabel.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    sublabel,
                    key: Key('ring-sublabel-${node.id}'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DeckType.body(
                      fontSize: 11,
                      color: DeckColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    },
  );

  if (style['card'] == true) {
    body = CardChrome(
      key: Key('ring-card-${node.id}'),
      accent: accent,
      title: style['title'] as String?,
      padding: const EdgeInsets.all(DeckSpacing.md),
      child: SizedBox(height: 120, child: body),
    );
  }
  return body;
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.accent});

  final double fraction;
  final Color accent;

  // Full sweep starting from the top (−90°), clockwise.
  static const double _start = -math.pi / 2;
  static const double _full = math.pi * 2;
  static const double _stroke = 12;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - _stroke;
    if (radius <= 0) return;
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Faint full track.
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: 0.08);
    canvas.drawArc(rect, _start, _full, false, track);

    if (fraction <= 0) return;
    final sweep = _full * fraction;

    final shader = SweepGradient(
      startAngle: _start,
      endAngle: _start + _full,
      colors: [
        Color.lerp(DeckColors.accentCyan, accent, 0.35)!,
        Color.lerp(DeckColors.accentPurple, accent, 0.35)!,
        Color.lerp(DeckColors.accentCyan, accent, 0.35)!,
      ],
      transform: GradientRotation(_start),
    ).createShader(rect);

    // Glow pass.
    canvas.drawArc(
      rect,
      _start,
      sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = _stroke
        ..strokeCap = StrokeCap.round
        ..shader = shader
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
    // Crisp value arc.
    canvas.drawArc(
      rect,
      _start,
      sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = _stroke
        ..strokeCap = StrokeCap.round
        ..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.accent != accent;
}
