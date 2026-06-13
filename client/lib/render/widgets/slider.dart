/// Slider widget (PROJ-183): a continuous control bound to a numeric state within
/// [min,max]. Dragging emits the `dragValue` slot carrying the level (e.g. drives
/// `media.volume.set{level}`, PROJ-187); the displayed position reflects the bound
/// state (host authority).
///
/// Repainted on the CyberDeck design system (Wave 1, C1): a neon slider with a
/// cyan→purple gradient active track and a glowing thumb. When the style asks for
/// a vertical orientation (`style.orientation == 'vertical'` or `style.vertical ==
/// true`) it renders as a VERTICAL volume slider with a `%` readout; otherwise it
/// stays the horizontal control. Either way the underlying [Slider] keeps its
/// `slider-<id>` key + the `dragValue` emit, so it stays editable and testable.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a slider from a render context (the registry builder).
Widget buildSlider(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final min = (node.config['min'] as num?)?.toDouble() ?? 0;
  final max = (node.config['max'] as num?)?.toDouble() ?? 100;
  final raw = ctx.value;
  final current = (raw is num ? raw.toDouble() : min).clamp(min, max);
  final accent = resolveAccent(node.appearance.style);

  final style = node.appearance.style;
  final vertical = style['orientation'] == 'vertical' || style['vertical'] == true;

  final slider = SliderTheme(
    data: _deckSliderTheme(accent),
    child: Slider(
      key: Key('slider-${node.id}'),
      min: min,
      max: max,
      value: current.toDouble(),
      onChanged: (level) => ctx.emit('dragValue', value: level),
    ),
  );

  if (!vertical) {
    return Center(child: slider);
  }

  // Vertical volume slider: rotate the real Slider a quarter turn (drag still
  // works; the key is preserved) and stack a % readout beneath it.
  final span = (max - min);
  final pct = span <= 0 ? 0 : (((current - min) / span) * 100).round();
  return CardChrome(
    accent: accent,
    padding: const EdgeInsets.symmetric(
      vertical: DeckSpacing.md,
      horizontal: DeckSpacing.sm,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Expanded(
          child: RotatedBox(
            quarterTurns: 3,
            child: slider,
          ),
        ),
        const SizedBox(height: DeckSpacing.xs),
        Text(
          '$pct%',
          key: Key('slider-readout-${node.id}'),
          style: DeckType.display(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: accent,
          ),
        ),
      ],
    ),
  );
}

/// A neon [SliderThemeData]: gradient-ish active track (accent), faint inactive
/// track, and a glowing thumb. The gradient is approximated by the accent plus a
/// soft overlay glow on the thumb (Slider tracks take a flat colour).
SliderThemeData _deckSliderTheme(Color accent) => SliderThemeData(
      trackHeight: 6,
      activeTrackColor: accent,
      inactiveTrackColor: Colors.white.withValues(alpha: 0.10),
      thumbColor: accent,
      overlayColor: accent.withValues(alpha: 0.18),
      thumbShape: _GlowThumbShape(accent: accent),
      overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
      trackShape: const RoundedRectSliderTrackShape(),
    );

/// A round slider thumb with a soft neon halo painted behind it.
class _GlowThumbShape extends SliderComponentShape {
  const _GlowThumbShape({required this.accent});

  final Color accent;
  final double radius = 9;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(radius);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    for (final glow in neonGlow(accent, blur: 10, spread: 0)) {
      canvas.drawCircle(
        center,
        radius + 3,
        Paint()
          ..color = glow.color
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, glow.blurRadius / 2),
      );
    }
    canvas.drawCircle(center, radius, Paint()..color = accent);
    canvas.drawCircle(
      center,
      radius - 3,
      Paint()..color = DeckColors.textPrimary.withValues(alpha: 0.9),
    );
  }
}
