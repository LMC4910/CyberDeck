/// Sparkline widget (PROJ-185): renders a numeric series as a smooth neon trace,
/// custom-painted (no chart lib) for the cyberpunk look. The series RIDES the
/// bound state — `ClientStateStore` is type-agnostic (`Object?`), so a state
/// whose value is a `List<num>` is delivered straight through with no store
/// change and no extra traffic. When the host instead streams scalar deltas (the
/// same state a gauge would follow), the sparkline appends each new sample to a
/// rolling window client-side, so a plain scalar telemetry state animates as a
/// trend without the host re-sending the whole history. Registered as `sparkline`.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a sparkline from a render context (the registry builder).
///
/// BARE by default under the granularity model (no card chrome) so it can sit on
/// top of a [panel]; set `style.card:true` to wrap it in its own [CardChrome].
Widget buildSparkline(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final accent = resolveAccent(node.appearance.style);
  final capacity = (node.config['capacity'] as num?)?.toInt() ?? 64;
  final spark = _Sparkline(
    key: Key('sparkline-${node.id}'),
    id: node.id,
    value: ctx.value,
    accent: accent,
    capacity: capacity < 2 ? 2 : capacity,
  );
  if (node.appearance.style['card'] == true) {
    return CardChrome(
      accent: accent,
      title: node.appearance.style['title'] as String?,
      padding: const EdgeInsets.all(DeckSpacing.md),
      child: SizedBox(height: 60, child: spark),
    );
  }
  return spark;
}

/// Coerces a bound value into a list of samples. A `List` rides through as the
/// full series; a scalar is a single new sample (appended by [_SparklineState]).
List<double>? seriesFromValue(Object? value) {
  if (value is List) {
    final out = <double>[];
    for (final e in value) {
      final n = _asDouble(e);
      if (n != null) out.add(n);
    }
    return out;
  }
  return null;
}

double? _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

class _Sparkline extends StatefulWidget {
  const _Sparkline({
    super.key,
    required this.id,
    required this.value,
    required this.accent,
    required this.capacity,
  });

  final String id;
  final Object? value;
  final Color accent;
  final int capacity;

  @override
  State<_Sparkline> createState() => _SparklineState();
}

class _SparklineState extends State<_Sparkline> {
  /// The rolling window of samples driving the trace.
  final List<double> _series = [];

  @override
  void initState() {
    super.initState();
    _ingest(widget.value);
  }

  @override
  void didUpdateWidget(_Sparkline old) {
    super.didUpdateWidget(old);
    // A state delta arrives as a new [value]; ingest it (append scalar / replace
    // list). No store change — the series rides the type-agnostic state.
    if (!identical(widget.value, old.value)) _ingest(widget.value);
  }

  void _ingest(Object? value) {
    final list = seriesFromValue(value);
    if (list != null) {
      // The state carries the whole series — mirror it (trimmed to capacity).
      _series
        ..clear()
        ..addAll(list);
    } else {
      // A scalar delta — append it to the rolling window.
      final sample = _asDouble(value);
      if (sample == null) return;
      _series.add(sample);
    }
    final overflow = _series.length - widget.capacity;
    if (overflow > 0) _series.removeRange(0, overflow);
  }

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      key: Key('sparkline-paint-${widget.id}'),
      painter: _SparklinePainter(
        series: List<double>.of(_series),
        accent: widget.accent,
      ),
      child: const SizedBox.expand(),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.series, required this.accent});

  final List<double> series;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;

    // A faint baseline so an empty / single-sample series still reads as a chart.
    final baseline = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = DeckColors.border;
    canvas.drawLine(
      Offset(0, size.height - 1),
      Offset(size.width, size.height - 1),
      baseline,
    );

    if (series.length < 2) return;

    var lo = series.first;
    var hi = series.first;
    for (final v in series) {
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
    final span = (hi - lo).abs();
    final range = span < 1e-9 ? 1.0 : span; // flat series → centred line
    const pad = 2.0;
    final usableH = math.max(0.0, size.height - 2 * pad);
    final dx = size.width / (series.length - 1);

    final path = Path();
    Offset? first;
    Offset last = Offset.zero;
    for (var i = 0; i < series.length; i++) {
      final x = dx * i;
      final norm = (series[i] - lo) / range; // 0..1
      final y = pad + (1 - norm) * usableH; // higher value → higher on screen
      final p = Offset(x, y);
      if (i == 0) {
        path.moveTo(x, y);
        first = p;
      } else {
        path.lineTo(x, y);
      }
      last = p;
    }

    // Soft gradient area below the trace for depth.
    if (first != null) {
      final area = Path.from(path)
        ..lineTo(last.dx, size.height)
        ..lineTo(first.dx, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              accent.withValues(alpha: 0.30),
              accent.withValues(alpha: 0.0),
            ],
          ).createShader(Offset.zero & size),
      );
    }

    // Outer glow pass under the crisp trace.
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = accent.withValues(alpha: 0.5)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );

    final trace = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = accent;
    canvas.drawPath(path, trace);
  }

  @override
  bool shouldRepaint(_SparklinePainter old) =>
      old.accent != accent || !_sameSeries(old.series, series);

  static bool _sameSeries(List<double> a, List<double> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
