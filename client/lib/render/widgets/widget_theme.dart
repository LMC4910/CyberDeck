/// Interim theme tokens for the built-in widgets (PROJ-184). The full theme/token
/// system + accessibility is PROJ-189; this small helper maps the handful of theme
/// names the gauges use to colors so they render with the neon look today, and is
/// superseded by 189's design tokens.
library;

import 'package:flutter/material.dart';

/// The default accent (neon cyan) when no theme/color is specified.
const Color kDefaultAccent = Color(0xFF22D3EE);

/// Maps a theme token to a color. Unknown tokens fall back to [fallback].
Color themeColor(String? theme, {Color fallback = kDefaultAccent}) {
  switch (theme) {
    case 'neon-cyan':
      return kDefaultAccent;
    case 'neon-magenta':
      return const Color(0xFFE879F9);
    case 'status-error':
      return const Color(0xFFFB7185);
    case 'status-warn':
      return const Color(0xFFFBBF24);
    case 'status-ok':
      return const Color(0xFF34D399);
    default:
      return fallback;
  }
}

/// Resolves a widget's base accent color from its style map: an explicit
/// `#RRGGBB`/`#AARRGGBB` `color`, else a `theme` token, else the default accent.
Color resolveAccent(Map<String, dynamic> style, {Color fallback = kDefaultAccent}) {
  final hex = style['color'] as String?;
  final parsed = _parseHexColor(hex);
  if (parsed != null) return parsed;
  return themeColor(style['theme'] as String?, fallback: fallback);
}

Color? _parseHexColor(String? hex) {
  if (hex == null) return null;
  var s = hex.replaceFirst('#', '').trim();
  if (s.length == 6) s = 'FF$s'; // assume opaque
  if (s.length != 8) return null;
  final v = int.tryParse(s, radix: 16);
  return v == null ? null : Color(v);
}
