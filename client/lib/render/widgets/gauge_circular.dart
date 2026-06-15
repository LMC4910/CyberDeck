/// Circular gauge widget (PROJ-184): renders a scalar state as a swept arc with a
/// centered value + label, custom-painted for the neon look (no chart lib) and
/// styled client-side by `valueRules` (e.g. red ≥85 with zero round-trip).
/// AC P1-AC-04 render. Registered as `gauge.circular`.
///
/// Repainted on the CyberDeck design system (Wave 1, C1): a glassmorphic
/// [CardChrome] panel, a big display-font value + unit centred in a 270°
/// cyan→purple gradient arc that glows over a faint track, and — when the bound
/// value (or `config.history`) carries a series — an inline mini sparkline plus a
/// small MIN / AVG / MAX stats row. All visuals derive from style/config + value,
/// so the widget stays Designer-editable.
library;

import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'gauge_common.dart';

/// Builds a circular gauge from a render context (the registry builder).
///
/// BARE by default under the granularity model (no built-in [CardChrome]) so it
/// can sit on top of a [panel]; set `style.card:true` to re-enable its own card.
/// Per-widget accent comes via `style.color`/`style.theme` (e.g. purple/green).
Widget buildCircularGauge(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final fraction = gaugeFraction(ctx.value, gaugeMin(node), gaugeMax(node));
  final accent = gaugeAccent(ctx.value, node);
  final valueText = formatValue(ctx.value, gaugeUnit(node));
  final title = gaugeTitle(node);

  // A series rides the bound value (List) or an explicit config.history slot;
  // it powers the inline sparkline + the min/avg/max stats. Explicit
  // config.stats {min,max,avg} wins over a series-derived summary.
  final series = gaugeSeries(ctx.value) ?? gaugeSeries(node.config['history']);
  final stats = gaugeExplicitStats(node.config['stats']) ?? gaugeStats(series);
  final sublabel = node.appearance.style['sublabel'] as String?;
  final card = node.appearance.style['card'] == true;

  // The bare ring (centre value + optional sublabel) — the elastic core that
  // shrinks first via FittedBox so nothing overflows a small cell.
  final ring = CustomPaint(
    painter: _CircularGaugePainter(fraction: fraction, accent: accent),
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(DeckSpacing.md),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                valueText,
                key: Key('gauge-value-${node.id}'),
                style: DeckType.display(
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                  color: accent,
                  height: 1.0,
                ),
              ),
              if (sublabel != null && sublabel.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  sublabel,
                  key: Key('gauge-sublabel-${node.id}'),
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
    ),
  );

  // The whole COMPOSITE card body (prototype "CPU TEMPERATURE" card): a Row of
  // [ ring | Min/Max/Avg stat column ] with a sparkline beneath. When there are
  // no stats it falls back to a centred ring; when the cell is short it drops the
  // sparkline. All adaptive via LayoutBuilder + FittedBox so it never overflows.
  final body = LayoutBuilder(
    builder: (context, constraints) {
      final h = constraints.maxHeight;
      final compact = h.isFinite && h < 150;
      final showSpark = !compact && series != null && series.length >= 2;
      final ringWithStats = (stats != null)
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(flex: 3, child: ring),
                const SizedBox(width: DeckSpacing.lg),
                Expanded(
                  flex: 2,
                  child: _StatsColumn(stats: stats, unit: gaugeUnit(node)),
                ),
              ],
            )
          : ring;

      return Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Flexible(child: ringWithStats),
          if (showSpark) ...[
            const SizedBox(height: DeckSpacing.sm),
            SizedBox(
              height: 28,
              child: CustomPaint(
                painter: _MiniSparkPainter(series: series, accent: accent),
                child: const SizedBox.expand(),
              ),
            ),
          ],
        ],
      );
    },
  );

  if (card) {
    return CardChrome(
      key: Key('gauge-card-${node.id}'),
      title: title,
      accent: accent,
      padding: const EdgeInsets.all(DeckSpacing.md),
      child: body,
    );
  }
  return body;
}

/// A Min / Max / Avg readout column beside the gauge ring (the prototype's
/// `flex-1 text-xs space-y-2` stat list). Each row is `label … value`.
class _StatsColumn extends StatelessWidget {
  const _StatsColumn({required this.stats, required this.unit});

  final ({double min, double max, double avg}) stats;
  final String? unit;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _row('Min', stats.min),
        const SizedBox(height: DeckSpacing.sm),
        _row('Max', stats.max),
        const SizedBox(height: DeckSpacing.sm),
        _row('Avg', stats.avg),
      ],
    );
  }

  Widget _row(String label, double value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DeckType.body(fontSize: 12, color: DeckColors.textSecondary),
          ),
        ),
        const SizedBox(width: DeckSpacing.sm),
        Text(
          formatValue(value, unit),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: DeckType.mono(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: DeckColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _CircularGaugePainter extends CustomPainter {
  _CircularGaugePainter({required this.fraction, required this.accent});

  final double fraction;
  final Color accent;

  // 270° sweep with a 90° gap at the bottom (starts at 135°).
  static const double _start = math.pi * 0.75;
  static const double _sweep = math.pi * 1.5;
  static const double _stroke = 10;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (math.min(size.width, size.height) / 2) - _stroke;
    if (radius <= 0) return;
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Faint track.
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: 0.08);
    canvas.drawArc(rect, _start, _sweep, false, track);

    if (fraction <= 0) return;

    final sweep = _sweep * fraction;
    // Cyan→purple gradient swept along the arc, blended toward the value accent
    // so a valueRules threshold (e.g. red ≥85) still tints the arc.
    final shader = SweepGradient(
      startAngle: _start,
      endAngle: _start + _sweep,
      colors: [
        Color.lerp(DeckColors.accentCyan, accent, 0.35)!,
        Color.lerp(DeckColors.accentPurple, accent, 0.35)!,
      ],
      transform: GradientRotation(_start),
    ).createShader(rect);

    // Outer glow pass.
    final glow = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round
      ..shader = shader
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6)
      ..color = accent.withValues(alpha: 0.6);
    canvas.drawArc(rect, _start, sweep, false, glow);

    // Crisp value arc.
    final value = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke
      ..strokeCap = StrokeCap.round
      ..shader = shader;
    canvas.drawArc(rect, _start, sweep, false, value);
  }

  @override
  bool shouldRepaint(_CircularGaugePainter old) =>
      old.fraction != fraction || old.accent != accent;
}

/// A tiny filled-trace sparkline for the inline trend beneath the gauge value.
class _MiniSparkPainter extends CustomPainter {
  _MiniSparkPainter({required this.series, required this.accent});

  final List<double> series;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0 || series.length < 2) return;

    var lo = series.first;
    var hi = series.first;
    for (final v in series) {
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
    final span = (hi - lo).abs();
    final range = span < 1e-9 ? 1.0 : span;
    const pad = 2.0;
    final usableH = math.max(0.0, size.height - 2 * pad);
    final dx = size.width / (series.length - 1);

    final pts = <Offset>[];
    for (var i = 0; i < series.length; i++) {
      final x = dx * i;
      final norm = (series[i] - lo) / range;
      pts.add(Offset(x, pad + (1 - norm) * usableH));
    }

    final line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final p in pts.skip(1)) {
      line.lineTo(p.dx, p.dy);
    }

    // Soft gradient fill below the trace.
    final fill = Path.from(line)
      ..lineTo(pts.last.dx, size.height)
      ..lineTo(pts.first.dx, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [accent.withValues(alpha: 0.28), accent.withValues(alpha: 0.0)],
        ).createShader(Offset.zero & size),
    );

    canvas.drawPath(
      line,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = accent,
    );
  }

  @override
  bool shouldRepaint(_MiniSparkPainter old) =>
      old.accent != accent || !listEquals(old.series, series);
}
