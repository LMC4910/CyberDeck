/// Slider widget (PROJ-183): a continuous control bound to a numeric state within
/// [min,max]. Dragging emits the `dragValue` slot carrying the level (e.g. drives
/// `media.volume.set{level}`, PROJ-187); the displayed position reflects the bound
/// state (host authority).
library;

import 'package:flutter/material.dart';

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

  return Slider(
    key: Key('slider-${node.id}'),
    min: min,
    max: max,
    value: current,
    activeColor: accent,
    onChanged: (level) => ctx.emit('dragValue', value: level),
  );
}
