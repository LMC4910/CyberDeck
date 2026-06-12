/// Theme adapter for the built-in widgets (PROJ-184, refactored for PROJ-189).
///
/// The CyberDeck design tokens now live in `lib/theme/tokens.dart` (the single
/// source of truth). This file keeps its small, STABLE public API —
/// [themeColor], [resolveAccent], [kDefaultAccent] — that existing widgets call,
/// but delegates every colour to the tokens so the palette stays consistent and
/// accessible (WCAG-AA neon-on-dark) in one place.
library;

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';

/// The default accent (neon cyan) when no theme/color is specified.
const Color kDefaultAccent = DeckColors.accent;

/// Maps a theme token name to a color. Unknown tokens fall back to [fallback].
///
/// Token names are the layout/profile vocabulary; they resolve to the
/// [DeckColors]/[DeckStatus] tokens so widgets and the app theme agree.
Color themeColor(String? theme, {Color fallback = kDefaultAccent}) {
  switch (theme) {
    case 'neon-cyan':
    case 'accent-cyan':
      return DeckColors.accentCyan;
    case 'neon-magenta':
    case 'accent-purple':
      return DeckColors.accentPurple;
    case 'status-error':
    case 'error':
      return DeckStatus.error.color;
    case 'status-warn':
    case 'warn':
      return DeckStatus.warn.color;
    case 'status-ok':
    case 'status-success':
    case 'success':
      return DeckStatus.success.color;
    case 'status-info':
    case 'info':
      return DeckStatus.info.color;
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
