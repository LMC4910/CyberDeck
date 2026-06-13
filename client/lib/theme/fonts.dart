/// Type-scale provider for the CyberDeck design system (Wave 0).
///
/// [DeckFonts] in `tokens.dart` names the font *roles* as plain strings (so the
/// tokens carry no package dependency). This layer is the one place that maps
/// those roles to real, renderable [TextStyle]s via `google_fonts`, fetching +
/// caching the families at runtime:
///
///  * [DeckFonts.display]    → Rajdhani       — hero numerals / big titles
///  * [DeckFonts.displayAlt] → Orbitron       — techy display alternate
///  * [DeckFonts.heading]    → Exo 2          — section headings
///  * [DeckFonts.body]       → Inter          — body / UI copy
///  * [DeckFonts.mono]       → JetBrains Mono — telemetry / fixed-width readouts
///
/// Use the role helpers ([DeckType.display] etc.) anywhere a [TextStyle] is
/// needed, and [deckTextTheme] to build the app [TextTheme] (see `app_theme.dart`).
/// Colours default to the [DeckColors] text tokens but are always overridable.
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Maps [DeckFonts] roles to concrete [TextStyle]s backed by Google Fonts.
///
/// Every helper layers the requested family/size/weight on top of an optional
/// [base] style and defaults the colour to a sensible text token — callers can
/// override `color`, `letterSpacing`, etc. via the named params or `.copyWith`.
abstract final class DeckType {
  /// Rajdhani — display numerals and hero titles ([DeckFonts.display]).
  static TextStyle display({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w600,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
    TextStyle? base,
  }) =>
      GoogleFonts.rajdhani(
        textStyle: base,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// Orbitron — techy display alternate ([DeckFonts.displayAlt]).
  static TextStyle displayAlt({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w600,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
    TextStyle? base,
  }) =>
      GoogleFonts.orbitron(
        textStyle: base,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// Exo 2 — section headings ([DeckFonts.heading]).
  static TextStyle heading({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w600,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
    TextStyle? base,
  }) =>
      GoogleFonts.exo2(
        textStyle: base,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// Inter — body / UI copy ([DeckFonts.body]).
  static TextStyle body({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
    TextStyle? base,
  }) =>
      GoogleFonts.inter(
        textStyle: base,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// JetBrains Mono — telemetry / fixed-width readouts ([DeckFonts.mono]).
  static TextStyle mono({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w400,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
    TextStyle? base,
  }) =>
      GoogleFonts.jetBrainsMono(
        textStyle: base,
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        letterSpacing: letterSpacing,
        height: height,
      );

  /// A small-caps-ish muted section label: Exo 2, wide tracking, [DeckColors]
  /// secondary text. The renderer upper-cases the text; this style supplies the
  /// tracking/weight that reads as a "small caps" header on a card.
  static TextStyle sectionLabel({
    double fontSize = 11,
    Color color = DeckColors.textSecondary,
  }) =>
      heading(
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
        color: color,
        letterSpacing: 1.4,
      );

  /// Resolves a [TextStyle] from a [DeckFonts] role string (the value stored in
  /// a layout/style map), so data-driven widgets can pick a family by name.
  /// Falls back to [body] for unknown roles.
  static TextStyle forRole(
    String? role, {
    double? fontSize,
    FontWeight? fontWeight,
    Color color = DeckColors.textPrimary,
    double? letterSpacing,
    double? height,
  }) {
    switch (role) {
      case DeckFonts.display:
        return display(
            fontSize: fontSize,
            fontWeight: fontWeight ?? FontWeight.w600,
            color: color,
            letterSpacing: letterSpacing,
            height: height);
      case DeckFonts.displayAlt:
        return displayAlt(
            fontSize: fontSize,
            fontWeight: fontWeight ?? FontWeight.w600,
            color: color,
            letterSpacing: letterSpacing,
            height: height);
      case DeckFonts.heading:
        return heading(
            fontSize: fontSize,
            fontWeight: fontWeight ?? FontWeight.w600,
            color: color,
            letterSpacing: letterSpacing,
            height: height);
      case DeckFonts.mono:
        return mono(
            fontSize: fontSize,
            fontWeight: fontWeight ?? FontWeight.w400,
            color: color,
            letterSpacing: letterSpacing,
            height: height);
      case DeckFonts.body:
      default:
        return body(
            fontSize: fontSize,
            fontWeight: fontWeight ?? FontWeight.w400,
            color: color,
            letterSpacing: letterSpacing,
            height: height);
    }
  }
}

/// Builds the app [TextTheme]: display/headline roles use the cyberpunk display
/// + heading families; body/label use Inter. Colours come from [DeckColors].
TextTheme deckTextTheme([TextTheme? base]) {
  final b = base ?? const TextTheme();
  return TextTheme(
    displayLarge: DeckType.display(
        base: b.displayLarge, fontSize: 57, fontWeight: FontWeight.w700),
    displayMedium: DeckType.display(
        base: b.displayMedium, fontSize: 45, fontWeight: FontWeight.w700),
    displaySmall: DeckType.display(
        base: b.displaySmall, fontSize: 36, fontWeight: FontWeight.w600),
    headlineLarge: DeckType.heading(
        base: b.headlineLarge, fontSize: 32, fontWeight: FontWeight.w600),
    headlineMedium: DeckType.heading(
        base: b.headlineMedium, fontSize: 28, fontWeight: FontWeight.w600),
    headlineSmall: DeckType.heading(
        base: b.headlineSmall, fontSize: 24, fontWeight: FontWeight.w600),
    titleLarge: DeckType.heading(
        base: b.titleLarge, fontSize: 22, fontWeight: FontWeight.w600),
    titleMedium: DeckType.heading(
        base: b.titleMedium, fontSize: 16, fontWeight: FontWeight.w600),
    titleSmall: DeckType.heading(
        base: b.titleSmall, fontSize: 14, fontWeight: FontWeight.w600),
    bodyLarge: DeckType.body(base: b.bodyLarge, fontSize: 16),
    bodyMedium: DeckType.body(base: b.bodyMedium, fontSize: 14),
    bodySmall: DeckType.body(
        base: b.bodySmall, fontSize: 12, color: DeckColors.textSecondary),
    labelLarge: DeckType.body(
        base: b.labelLarge, fontSize: 14, fontWeight: FontWeight.w600),
    labelMedium: DeckType.body(
        base: b.labelMedium, fontSize: 12, fontWeight: FontWeight.w600),
    labelSmall: DeckType.body(
        base: b.labelSmall,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: DeckColors.textSecondary),
  );
}
