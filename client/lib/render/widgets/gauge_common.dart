/// Shared gauge helpers (PROJ-184): pure functions for the circular + linear
/// gauges so the value math and conditional (`valueRules`) styling are unit-tested
/// independently of the painters.
library;

import 'package:flutter/material.dart';

import '../model.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Normalised fill fraction for [value] within [min]..[max], clamped to 0..1.
double gaugeFraction(Object? value, num min, num max) {
  final v = _asNum(value);
  if (v == null || max <= min) return 0;
  final f = (v - min) / (max - min);
  if (f.isNaN) return 0;
  return f.clamp(0.0, 1.0).toDouble();
}

/// The accent color for the current value: the first matching `valueRules` style
/// (zero round-trip conditional styling, 2C §7.2), else the widget's base accent.
Color gaugeAccent(Object? value, WidgetNode node) {
  final matched = evaluateValueRules(value, node.appearance.valueRules);
  if (matched != null) {
    return resolveAccent(matched, fallback: resolveAccent(node.appearance.style));
  }
  return resolveAccent(node.appearance.style);
}

/// Formats a value for display, appending [unit]; "--" when unavailable.
String formatValue(Object? value, String? unit) {
  if (value == null) return '--';
  final v = _asNum(value);
  final text = v == null
      ? '$value'
      : (v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1));
  return unit == null || unit.isEmpty ? text : '$text$unit';
}

/// Reads the numeric `min` from a node config (default 0).
num gaugeMin(WidgetNode node) => _asNum(node.config['min']) ?? 0;

/// Reads the numeric `max` from a node config (default 100).
num gaugeMax(WidgetNode node) => _asNum(node.config['max']) ?? 100;

/// Reads the display `unit` from a node config.
String? gaugeUnit(WidgetNode node) => node.config['unit'] as String?;

num? _asNum(Object? value) {
  if (value is num) return value;
  if (value is String) return num.tryParse(value);
  return null;
}
