/// Linear gauge / bar widget (PROJ-184): renders a scalar/percent state as a
/// horizontal fill with a value label, styled client-side by `valueRules`.
/// AC P1-AC-04 render. Registered as `gauge.linear` (alias `gauge.bar`).
library;

import 'package:flutter/material.dart';

import '../registry.dart';
import 'gauge_common.dart';

/// Builds a linear gauge/bar from a render context (the registry builder).
Widget buildLinearGauge(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final fraction = gaugeFraction(ctx.value, gaugeMin(node), gaugeMax(node));
  final accent = gaugeAccent(ctx.value, node);
  final label = node.appearance.style['label'] as String? ?? '';
  final valueText = formatValue(ctx.value, gaugeUnit(node));

  return Padding(
    padding: const EdgeInsets.all(8),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (label.isNotEmpty)
              Text(label,
                  key: Key('gauge-label-${node.id}'),
                  style: const TextStyle(fontSize: 11, color: Colors.white70)),
            Text(
              valueText,
              key: Key('gauge-value-${node.id}'),
              style: TextStyle(
                color: accent,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: CustomPaint(
            size: const Size(double.infinity, 8),
            painter: _LinearGaugePainter(fraction: fraction, accent: accent),
          ),
        ),
      ],
    ),
  );
}

class _LinearGaugePainter extends CustomPainter {
  _LinearGaugePainter({required this.fraction, required this.accent});

  final double fraction;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final track = Paint()..color = Colors.white.withValues(alpha: 0.12);
    canvas.drawRect(Offset.zero & size, track);
    if (fraction > 0) {
      final fill = Paint()..color = accent;
      canvas.drawRect(
        Offset.zero & Size(size.width * fraction, size.height),
        fill,
      );
    }
  }

  @override
  bool shouldRepaint(_LinearGaugePainter old) =>
      old.fraction != fraction || old.accent != accent;
}
