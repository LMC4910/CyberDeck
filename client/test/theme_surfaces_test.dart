// Wave 0 design-system smoke test: the shared visual kit (theme/app_theme,
// theme/surfaces, theme/fonts) compiles and renders without throwing, and the
// pure helpers return the expected tokens. Fonts are bundled assets (no network
// / no google_fonts), so these run deterministically offline.

import 'package:cyberdeck_client/theme/app_theme.dart';
import 'package:cyberdeck_client/theme/fonts.dart';
import 'package:cyberdeck_client/theme/surfaces.dart';
import 'package:cyberdeck_client/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('pure helpers', () {
    test('accentGradient is the cyan→purple brand sweep', () {
      final g = accentGradient();
      expect(g.colors.first, DeckColors.accentCyan);
      expect(g.colors.last, DeckColors.accentPurple);
    });

    test('cardGradient eases elevated→card', () {
      final g = cardGradient();
      expect(g.colors.first, DeckColors.elevated);
      expect(g.colors.last, DeckColors.card);
    });

    test('neonGlow returns a non-empty, low-alpha shadow list', () {
      final glow = neonGlow(DeckColors.accentCyan);
      expect(glow, isNotEmpty);
      for (final s in glow) {
        expect(s.color.a, lessThan(0.5));
        expect(s.blurRadius, greaterThan(0));
      }
    });

    test('intensity scales the glow alpha', () {
      final dim = neonGlow(DeckColors.accentCyan, intensity: 0.5).first.color.a;
      final full = neonGlow(DeckColors.accentCyan).first.color.a;
      expect(dim, lessThan(full));
    });

    test('DeckType roles resolve to bundled families with the expected colour', () {
      expect(DeckType.display().color, DeckColors.textPrimary);
      expect(DeckType.display().fontFamily, 'Rajdhani');
      expect(DeckType.body().fontFamily, 'Inter');
      expect(DeckType.mono().fontFamily, 'JetBrains Mono');
      expect(DeckType.sectionLabel().color, DeckColors.textSecondary);
      expect(DeckType.forRole(DeckFonts.mono).fontWeight, FontWeight.w400);
    });
  });

  group('theme', () {
    test('buildDeckTheme is a dark theme rooted in the tokens', () {
      final t = buildDeckTheme();
      expect(t.brightness, Brightness.dark);
      expect(t.scaffoldBackgroundColor, DeckColors.bg);
      expect(t.colorScheme.primary, DeckColors.accentCyan);
      expect(t.colorScheme.secondary, DeckColors.accentPurple);
      expect(t.applyElevationOverlayColor, isFalse);
    });
  });

  group('renders without throwing', () {
    testWidgets('CardChrome with title + trailing inside the app theme',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildDeckTheme(),
          home: const Scaffold(
            body: BackgroundGradient(
              child: Center(
                child: SizedBox(
                  width: 240,
                  child: CardChrome(
                    title: 'System',
                    trailing: Icon(Icons.bolt, size: 16),
                    accent: DeckColors.accentPurple,
                    child: Text('content'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('SYSTEM'), findsOneWidget); // upper-cased header
      expect(find.text('content'), findsOneWidget);
      expect(find.byType(CardChrome), findsOneWidget);
    });

    testWidgets('CardChrome without a title renders just the body',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(child: CardChrome(child: Text('bare'))),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('bare'), findsOneWidget);
    });
  });
}
