/// Reusable glassmorphic surface kit for the CyberDeck design system (Wave 0).
///
/// Everything visual the rest of the client composes from lives here, built
/// purely from the [DeckColors]/[DeckSpacing] tokens and the [DeckType] type
/// scale — no palette literals leak past this file:
///
///  * [CardChrome]       — a titled glassmorphic panel (gradient fill, hairline
///                         border, soft outer accent glow, optional small-caps
///                         header + trailing slot).
///  * [neonGlow]         — the standard outer-glow [BoxShadow] list for an accent.
///  * [accentGradient]   — the cyan→purple brand [LinearGradient].
///  * [cardGradient]     — the subtle top-lighter card fill gradient.
///  * [BackgroundGradient] — the deep-navy app background.
///
/// All widgets here are stateless and side-effect free so they are cheap to
/// rebuild and safe to share across the tree.
library;

import 'package:flutter/material.dart';

import 'fonts.dart';
import 'tokens.dart';

/// Default card corner radius for the glassmorphic look (~14px, per the visual
/// target — softer than the tighter control radius in [DeckSpacing.radius]).
const double kCardRadius = 14;

/// The brand cyan→purple gradient ([DeckColors.accentCyan] → [accentPurple]).
///
/// Used for accent fills, hairline highlights, and gradient text/icons. Defaults
/// to a top-left → bottom-right sweep.
LinearGradient accentGradient({
  Alignment begin = Alignment.topLeft,
  Alignment end = Alignment.bottomRight,
}) =>
    LinearGradient(
      begin: begin,
      end: end,
      colors: const [DeckColors.accentCyan, DeckColors.accentPurple],
    );

/// The subtle top-lighter card fill: [DeckColors.elevated] at the top easing to
/// [DeckColors.card] at the bottom, giving panels a faint lit-from-above sheen.
LinearGradient cardGradient() => const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [DeckColors.elevated, DeckColors.card],
    );

/// The standard outer glow for an accent [color]: a soft, low-alpha halo plus a
/// tighter inner bloom. Returned as a [BoxShadow] list ready for a [BoxDecoration].
///
/// [intensity] scales the alpha (1.0 = default). [blur] is the outer-halo blur.
List<BoxShadow> neonGlow(
  Color color, {
  double intensity = 1.0,
  double blur = 22,
  double spread = -4,
}) =>
    [
      BoxShadow(
        color: color.withValues(alpha: 0.22 * intensity),
        blurRadius: blur,
        spreadRadius: spread,
      ),
      BoxShadow(
        color: color.withValues(alpha: 0.10 * intensity),
        blurRadius: blur * 1.8,
        spreadRadius: spread + 2,
      ),
    ];

/// A glassmorphic titled panel — the canonical CyberDeck card.
///
/// Paints the [cardGradient] fill, a 1px [DeckColors.border] hairline, a ~14px
/// ([kCardRadius]) radius and a soft outer [neonGlow] in [accent] at low alpha.
/// When [title] is set it renders a small-caps muted header (optionally with a
/// [trailing] slot) above [child]; otherwise [child] fills the padded body.
///
/// Stateless and pure: appearance is fully determined by its props, so it is
/// safe to drop into a data-driven render path. Data-driven widgets typically
/// read their own accent/title from `appearance.style`/`config` and pass them in.
class CardChrome extends StatelessWidget {
  const CardChrome({
    super.key,
    required this.child,
    this.title,
    this.trailing,
    this.accent = DeckColors.accent,
    this.padding,
    this.glow = true,
    this.borderColor,
    this.radius = kCardRadius,
  });

  /// Panel content.
  final Widget child;

  /// Optional small-caps section header. Rendered upper-cased + tracked.
  final String? title;

  /// Optional widget pinned to the trailing edge of the header row.
  final Widget? trailing;

  /// Accent that tints the outer glow (and is available to the title row).
  final Color accent;

  /// Content padding (defaults to [DeckSpacing.lg] all round).
  final EdgeInsetsGeometry? padding;

  /// Whether to draw the outer neon glow.
  final bool glow;

  /// Border colour override (defaults to [DeckColors.border]).
  final Color? borderColor;

  /// Corner radius (defaults to [kCardRadius]).
  final double radius;

  @override
  Widget build(BuildContext context) {
    final pad = padding ?? const EdgeInsets.all(DeckSpacing.lg);
    final hasTitle = title != null && title!.trim().isNotEmpty;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: cardGradient(),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? DeckColors.border, width: 1),
        boxShadow: glow ? neonGlow(accent) : const [],
      ),
      child: Padding(
        padding: pad,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (hasTitle) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title!.toUpperCase(),
                      style: DeckType.sectionLabel(),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  ?trailing,
                ],
              ),
              const SizedBox(height: DeckSpacing.sm),
            ],
            Flexible(child: child),
          ],
        ),
      ),
    );
  }
}

/// The app background: a deep-navy vertical gradient from [DeckColors.bg] easing
/// to a slightly darker tone, matching the cyberpunk "Control Center" target.
///
/// Drop it behind a [Scaffold] body (or use it as the scaffold background) — it
/// fills its constraints and paints [child] (if any) on top.
class BackgroundGradient extends StatelessWidget {
  const BackgroundGradient({super.key, this.child});

  /// Optional foreground content painted over the gradient.
  final Widget? child;

  /// The deepest tone at the bottom of the sweep (~#0A0A16).
  static const Color _deep = Color(0xFF0A0A16);

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [DeckColors.bg, _deep],
        ),
      ),
      child: child,
    );
  }
}
