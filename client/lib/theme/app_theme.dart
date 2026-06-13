/// The CyberDeck app [ThemeData] (Wave 0).
///
/// Built entirely from `tokens.dart` + `fonts.dart`: a dark scheme whose canvas
/// is [DeckColors.bg], primary/secondary are the cyan/purple accents, surfaces
/// are the card/elevated tokens, and the text theme comes from [deckTextTheme].
/// Material's default elevation surface-tint is disabled so panels keep their
/// flat glassmorphic look (the glow comes from [CardChrome], not Material tint).
library;

import 'package:flutter/material.dart';

import 'fonts.dart';
import 'tokens.dart';

/// Assembles the dark CyberDeck [ThemeData].
ThemeData buildDeckTheme() {
  const scheme = ColorScheme.dark(
    primary: DeckColors.accentCyan,
    onPrimary: DeckColors.bg,
    secondary: DeckColors.accentPurple,
    onSecondary: DeckColors.textPrimary,
    surface: DeckColors.card,
    onSurface: DeckColors.textPrimary,
    error: Color(0xFFFF5252),
    onError: DeckColors.textPrimary,
    outline: DeckColors.border,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: DeckColors.bg,
    canvasColor: DeckColors.bg,
    // No Material elevation surface tinting — the deck stays flat + glassy.
    applyElevationOverlayColor: false,
  );

  return base.copyWith(
    textTheme: deckTextTheme(base.textTheme),
    scaffoldBackgroundColor: DeckColors.bg,
    dividerColor: DeckColors.border,
    splashColor: DeckColors.accentCyan.withValues(alpha: 0.12),
    highlightColor: DeckColors.accentCyan.withValues(alpha: 0.08),
    cardTheme: const CardThemeData(
      color: DeckColors.card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: DeckColors.bg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: DeckColors.textPrimary,
      elevation: 0,
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: DeckColors.elevated,
      surfaceTintColor: Colors.transparent,
    ),
    popupMenuTheme: const PopupMenuThemeData(
      color: DeckColors.elevated,
      surfaceTintColor: Colors.transparent,
    ),
    iconTheme: const IconThemeData(color: DeckColors.textPrimary),
  );
}
