/// Visualizer widget (Wave 0 / granularity model): a decorative animated audio
/// equalizer — a row of bars whose heights breathe in a neon accent (the
/// "Visualizer Placeholder" box in prototype.html). Purely cosmetic: it never
/// represents real audio data.
///
/// It is a BARE widget by default (no card chrome) so it can sit on top of a
/// [panel]; set `style.card:true` to wrap it in its own [CardChrome]. The bars
/// animate unless the bound value is `false` (or `style.animate:false`), so a
/// host can freeze it. Data-driven: `style.color`/`style.theme` accent,
/// `config.bars` count. Registered as `visualizer`.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a visualizer from a render context (the registry builder).
Widget buildVisualizer(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final bars = ((node.config['bars'] as num?)?.toInt() ?? 12).clamp(3, 64);
  // Animates by default; freezes when the bound value is false or style says so.
  final animate = ctx.value != false && style['animate'] != false;

  Widget body = _Visualizer(
    id: node.id,
    accent: accent,
    bars: bars,
    animate: animate,
  );

  if (style['card'] == true) {
    body = CardChrome(
      accent: accent,
      padding: const EdgeInsets.all(DeckSpacing.md),
      child: SizedBox(height: 80, child: body),
    );
  }
  return body;
}

class _Visualizer extends StatefulWidget {
  const _Visualizer({
    required this.id,
    required this.accent,
    required this.bars,
    required this.animate,
  });

  final String id;
  final Color accent;
  final int bars;
  final bool animate;

  @override
  State<_Visualizer> createState() => _VisualizerState();
}

class _VisualizerState extends State<_Visualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late List<double> _phase;

  @override
  void initState() {
    super.initState();
    _seedPhases();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    if (widget.animate) _c.repeat();
  }

  void _seedPhases() {
    final rnd = math.Random(11);
    _phase = [for (var i = 0; i < widget.bars; i++) rnd.nextDouble() * math.pi * 2];
  }

  @override
  void didUpdateWidget(covariant _Visualizer old) {
    super.didUpdateWidget(old);
    if (widget.bars != old.bars) _seedPhases();
    if (widget.animate && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.animate && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      key: Key('visualizer-${widget.id}'),
      animation: _c,
      builder: (context, _) {
        return CustomPaint(
          painter: _VisualizerPainter(
            t: _c.value,
            phase: _phase,
            accent: widget.accent,
            animate: widget.animate,
          ),
          child: const SizedBox.expand(),
        );
      },
    );
  }
}

class _VisualizerPainter extends CustomPainter {
  _VisualizerPainter({
    required this.t,
    required this.phase,
    required this.accent,
    required this.animate,
  });

  final double t;
  final List<double> phase;
  final Color accent;
  final bool animate;

  @override
  void paint(Canvas canvas, Size size) {
    final n = phase.length;
    if (n == 0 || size.width <= 0 || size.height <= 0) return;
    const gap = 4.0;
    final barW = (size.width - gap * (n - 1)) / n;
    if (barW <= 0) return;
    final radius = Radius.circular(math.min(2.5, barW / 2));

    for (var i = 0; i < n; i++) {
      final wave = animate
          ? (math.sin(t * math.pi * 2 + phase[i]) * 0.5 + 0.5)
          : 0.25;
      final h = (0.15 + 0.85 * wave) * size.height;
      final x = i * (barW + gap);
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, size.height - h, barW, h),
        radius,
      );
      // Glow then crisp bar.
      canvas.drawRRect(
        rect,
        Paint()
          ..color = accent.withValues(alpha: 0.45)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
      canvas.drawRRect(rect, Paint()..color = accent);
    }
  }

  @override
  bool shouldRepaint(covariant _VisualizerPainter old) =>
      old.t != t || old.animate != animate || old.accent != accent;
}
