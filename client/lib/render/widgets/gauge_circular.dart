/// Circular gauge widget (PROJ-184): renders a scalar state as a swept arc with a
/// centered value + label, custom-painted for the neon look (no chart lib) and
/// styled client-side by `valueRules` (e.g. red ≥85 with zero round-trip).
/// AC P1-AC-04 render. Registered as `gauge.circular`.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../registry.dart';
import 'gauge_common.dart';

/// Builds a circular gauge from a render context (the registry builder).
Widget buildCircularGauge(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final fraction = gaugeFraction(ctx.value, gaugeMin(node), gaugeMax(node));
  final accent = gaugeAccent(ctx.value, node);
  final label = node.appearance.style['label'] as String? ?? '';
  final valueText = formatValue(ctx.value, gaugeUnit(node));

  return CustomPaint(
    painter: _CircularGaugePainter(fraction: fraction, accent: accent),
    child: Center(
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              valueText,
              key: Key('gauge-value-${node.id}'),
              style: TextStyle(
                color: accent,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (label.isNotEmpty)
              Text(
                label,
                key: Key('gauge-label-${node.id}'),
                style: const TextStyle(fontSize: 11, color: Colors.white70),
              ),
          ],
        ),
      ),
    ),
  );
}

class _CircularGaugePainter extends CustomPainter {
  _CircularGaugePainter({required this.fraction, required this.accent});

  final double fraction;
  final Color accent;

  // 270° sweep with a 90° gap at the bottom (starts at 135°).
  static const double _start = math.pi * 0.75;
  static const double _sweep = math.pi * 1.5;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - 8;
    if (radius <= 0) return;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: 0.12);
    canvas.drawArc(rect, _start, _sweep, false, track);

    if (fraction > 0) {
      final value = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round
        ..color = accent;
      canvas.drawArc(rect, _start, _sweep * fraction, false, value);
    }
  }

  @override
  bool shouldRepaint(_CircularGaugePainter old) =>
      old.fraction != fraction || old.accent != accent;
}
