/// CyberDeck design tokens (PROJ-189): the single source of truth for colours,
/// typography, spacing and status semantics across the client. Widgets and the
/// app theme delegate here so the cyberpunk look is consistent and the palette
/// can be tuned in one place.
///
/// Accessibility is a first-class concern (PROJ-189 AC):
///  * Foreground/background pairings meet WCAG-AA contrast (>= 4.5:1) — see
///    [contrastRatio] and the [DeckStatus] foreground colours, which are tuned
///    to read against [DeckColors.bg]/[DeckColors.card].
///  * Status is never colour-alone: every [DeckStatus] carries an [icon] and a
///    [label] so meaning survives for colour-blind users and greyscale.
///  * Interactive targets use [DeckSpacing.minTouchTarget] (48dp) as a floor.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Core surface, border and accent colours of the CyberDeck palette.
abstract final class DeckColors {
  /// App background — the deepest surface.
  static const Color bg = Color(0xFF0D0D1A);

  /// Card surface (one step above [bg]).
  static const Color card = Color(0xFF141428);

  /// Elevated surface (modals, popovers, raised controls).
  static const Color elevated = Color(0xFF1A1A38);

  /// Hairline border / divider colour.
  static const Color border = Color(0xFF2D2D5E);

  /// Primary brand accent (purple).
  static const Color accentPurple = Color(0xFF7B2FBE);

  /// Secondary brand accent (cyan).
  static const Color accentCyan = Color(0xFF00B4D8);

  /// Default accent used when nothing else is specified.
  static const Color accent = accentCyan;

  /// High-contrast text on dark surfaces (near-white). ~16:1 on [bg].
  static const Color textPrimary = Color(0xFFF2F3FF);

  /// Muted secondary text. Tuned to keep >= 4.5:1 on [bg]/[card].
  static const Color textSecondary = Color(0xFFB9BCE0);
}

/// Semantic status. Each value bundles a colour AND an [icon] + [label] so
/// status is conveyed by more than colour alone (WCAG 1.4.1 Use of Color).
enum DeckStatus {
  success(Color(0xFF00E676), Icons.check_circle_outline, 'OK'),
  warn(Color(0xFFFFAB40), Icons.warning_amber_outlined, 'Warning'),
  error(Color(0xFFFF5252), Icons.error_outline, 'Error'),
  info(Color(0xFF448AFF), Icons.info_outline, 'Info');

  const DeckStatus(this.color, this.icon, this.label);

  /// The status colour (used for fills/borders/icons).
  final Color color;

  /// An icon that conveys the status without relying on colour.
  final IconData icon;

  /// A short text label that conveys the status without relying on colour.
  final String label;
}

/// Typography token families. Names are plain strings so the tokens carry no
/// extra package dependency; a font-provider layer can map these to bundled or
/// Google fonts. The roles below match the CyberDeck type scale.
abstract final class DeckFonts {
  /// Display / hero numerals and big titles (Rajdhani, Orbitron fallback).
  static const String display = 'Rajdhani';

  /// Display fallback for techy numerals.
  static const String displayAlt = 'Orbitron';

  /// Section headings.
  static const String heading = 'Exo 2';

  /// Body / UI copy.
  static const String body = 'Inter';

  /// Monospace (telemetry, code, fixed-width readouts).
  static const String mono = 'JetBrains Mono';
}

/// 4dp-based spacing scale plus accessibility floors.
abstract final class DeckSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;

  /// Minimum interactive target size (WCAG 2.5.5 / Material): 48x48 dp.
  static const double minTouchTarget = 48;

  /// Default corner radius for cards/controls.
  static const double radius = 8;
}

/// Minimum WCAG-AA contrast ratio for normal text.
const double kWcagAaNormal = 4.5;

/// Minimum WCAG-AA contrast ratio for large text / UI components.
const double kWcagAaLarge = 3.0;

/// Relative luminance of [c] per WCAG 2.x (sRGB linearised).
double relativeLuminance(Color c) {
  double channel(double s) {
    // s is already 0..1 (Flutter wide-gamut component double).
    return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
  }

  // Color exposes 0..1 component doubles (Flutter wide-gamut API).
  final r = channel(c.r);
  final g = channel(c.g);
  final b = channel(c.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// WCAG contrast ratio between [a] and [b] (>= 1.0; 21.0 is black-on-white).
double contrastRatio(Color a, Color b) {
  final la = relativeLuminance(a);
  final lb = relativeLuminance(b);
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/// Whether [foreground] on [background] meets WCAG-AA for normal text.
bool meetsAaNormal(Color foreground, Color background) =>
    contrastRatio(foreground, background) >= kWcagAaNormal;
