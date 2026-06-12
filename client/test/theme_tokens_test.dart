import 'package:cyberdeck_client/render/widgets/widget_theme.dart';
import 'package:cyberdeck_client/theme/tokens.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('contrast utility', () {
    test('black on white is the 21:1 extreme', () {
      expect(
        contrastRatio(const Color(0xFF000000), const Color(0xFFFFFFFF)),
        closeTo(21.0, 0.05),
      );
    });

    test('identical colours have ratio 1.0', () {
      expect(contrastRatio(DeckColors.bg, DeckColors.bg), closeTo(1.0, 1e-9));
    });

    test('ratio is symmetric', () {
      final a = contrastRatio(DeckColors.textPrimary, DeckColors.bg);
      final b = contrastRatio(DeckColors.bg, DeckColors.textPrimary);
      expect(a, closeTo(b, 1e-9));
    });

    test('a known pairing matches the WCAG formula (#777 on white ~4.48)', () {
      // Sanity-check the luminance maths against a published value.
      final r = contrastRatio(const Color(0xFF777777), const Color(0xFFFFFFFF));
      expect(r, closeTo(4.48, 0.05));
    });
  });

  group('WCAG-AA text contrast (>= 4.5:1)', () {
    // The surfaces text/status may sit on.
    const surfaces = <String, Color>{
      'bg': DeckColors.bg,
      'card': DeckColors.card,
      'elevated': DeckColors.elevated,
    };

    test('primary text passes AA on every surface', () {
      surfaces.forEach((name, surface) {
        final r = contrastRatio(DeckColors.textPrimary, surface);
        expect(r, greaterThanOrEqualTo(kWcagAaNormal),
            reason: 'textPrimary on $name was $r');
      });
    });

    test('secondary text passes AA on bg and card', () {
      for (final surface in [DeckColors.bg, DeckColors.card]) {
        final r = contrastRatio(DeckColors.textSecondary, surface);
        expect(r, greaterThanOrEqualTo(kWcagAaNormal),
            reason: 'textSecondary contrast was $r');
      }
    });

    test('every status colour passes AA on bg and card', () {
      for (final status in DeckStatus.values) {
        for (final entry in {'bg': DeckColors.bg, 'card': DeckColors.card}.entries) {
          final r = contrastRatio(status.color, entry.value);
          expect(r, greaterThanOrEqualTo(kWcagAaNormal),
              reason: '${status.name} on ${entry.key} was $r');
        }
      }
    });

    test('meetsAaNormal agrees with the threshold', () {
      expect(meetsAaNormal(DeckColors.textPrimary, DeckColors.bg), isTrue);
      expect(meetsAaNormal(DeckColors.bg, DeckColors.card), isFalse);
    });
  });

  group('status conveys meaning beyond colour', () {
    test('each status carries a distinct icon and non-empty label', () {
      final icons = <IconData>{};
      final labels = <String>{};
      for (final status in DeckStatus.values) {
        expect(status.label.trim(), isNotEmpty, reason: '${status.name} label');
        icons.add(status.icon);
        labels.add(status.label);
      }
      // No two statuses share an icon or a label (colour-blind / greyscale safe).
      expect(icons.length, DeckStatus.values.length);
      expect(labels.length, DeckStatus.values.length);
    });
  });

  group('touch targets', () {
    test('minimum touch target meets the 48x48 floor', () {
      expect(DeckSpacing.minTouchTarget, greaterThanOrEqualTo(48));
    });

    test('a control sized to the token satisfies a 48x48 size assertion', () {
      const size = Size.square(DeckSpacing.minTouchTarget);
      expect(size.width, greaterThanOrEqualTo(48));
      expect(size.height, greaterThanOrEqualTo(48));
    });
  });

  group('spacing scale', () {
    test('is positive and strictly increasing', () {
      final scale = <double>[
        DeckSpacing.xs,
        DeckSpacing.sm,
        DeckSpacing.md,
        DeckSpacing.lg,
        DeckSpacing.xl,
        DeckSpacing.xxl,
        DeckSpacing.xxxl,
      ];
      for (var i = 0; i < scale.length; i++) {
        expect(scale[i], greaterThan(0));
        if (i > 0) expect(scale[i], greaterThan(scale[i - 1]));
      }
    });
  });

  group('widget_theme delegates to tokens (stable public API)', () {
    test('kDefaultAccent is the cyan accent token', () {
      expect(kDefaultAccent, DeckColors.accent);
      expect(kDefaultAccent, DeckColors.accentCyan);
    });

    test('themeColor maps status tokens to DeckStatus colours', () {
      expect(themeColor('status-error'), DeckStatus.error.color);
      expect(themeColor('status-warn'), DeckStatus.warn.color);
      expect(themeColor('status-ok'), DeckStatus.success.color);
      expect(themeColor('status-info'), DeckStatus.info.color);
    });

    test('themeColor falls back for unknown tokens', () {
      expect(themeColor(null), kDefaultAccent);
      expect(themeColor('nope', fallback: DeckColors.accentPurple),
          DeckColors.accentPurple);
    });

    test('resolveAccent prefers an explicit hex over the theme token', () {
      expect(
        resolveAccent({'color': '#7B2FBE', 'theme': 'status-error'}),
        DeckColors.accentPurple,
      );
      expect(resolveAccent({'theme': 'accent-cyan'}), DeckColors.accentCyan);
      expect(resolveAccent(const {}), kDefaultAccent);
    });
  });
}
