/// Game-poster card (Wave A composite): a SINGLE card showing box art (an asset
/// image, or a procedural brand gradient fallback) with the game title overlaid
/// at the bottom and a glowing play/launch affordance — the one-node form of a
/// Gaming Hub "favourite / library" poster.
///
/// Tapping emits the `tap` slot (the host maps it to a launch action) — it never
/// launches locally. Data-driven: `style.title`/`config.title`, `style.art`/
/// `style.asset` (the art asset path), `style.subtitle` (e.g. "Last played"),
/// `style.color`/`theme` accent. Owns its card surface.
/// Registered as `game.poster`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a game poster from a render context (the registry builder).
Widget buildGamePoster(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final title = style['title'] as String? ?? node.config['title'] as String? ?? '';
  final subtitle = style['subtitle'] as String?;
  final art = style['art'] as String? ?? style['asset'] as String?;

  return Material(
    type: MaterialType.transparency,
    child: InkWell(
      key: Key('game-poster-${node.id}'),
      borderRadius: BorderRadius.circular(kCardRadius),
      onTap: () => ctx.emit('tap'),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(kCardRadius),
          border: Border.all(color: DeckColors.border),
          boxShadow: neonGlow(accent, intensity: 0.6),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(kCardRadius),
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Art(id: node.id, art: art, accent: accent),
              // A bottom scrim so the title stays legible over busy art.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xCC0A0A16)],
                  ),
                ),
              ),
              // Play affordance, pinned top-right.
              Positioned(
                top: DeckSpacing.sm,
                right: DeckSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.all(DeckSpacing.xs),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: accentGradient(),
                    boxShadow: neonGlow(accent, intensity: 0.8),
                  ),
                  child: const Icon(Icons.play_arrow, color: Colors.white, size: 18),
                ),
              ),
              Positioned(
                left: DeckSpacing.md,
                right: DeckSpacing.md,
                bottom: DeckSpacing.md,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      key: Key('game-title-${node.id}'),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: DeckType.heading(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: DeckColors.textPrimary,
                      ),
                    ),
                    if (subtitle != null && subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        key: Key('game-subtitle-${node.id}'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DeckType.body(
                          fontSize: 11,
                          color: DeckColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// The poster art: the asset when it loads, else a procedural gradient face.
class _Art extends StatelessWidget {
  const _Art({required this.id, required this.art, required this.accent});

  final String id;
  final String? art;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final fallback = DecoratedBox(
      key: Key('game-art-fallback-$id'),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(accent.withValues(alpha: 0.55), DeckColors.accentCyan),
            DeckColors.accentPurple,
          ],
        ),
      ),
      child: const Center(
        child: Icon(Icons.sports_esports_outlined, color: Colors.white, size: 40),
      ),
    );
    if (art != null && art!.isNotEmpty) {
      return Image.asset(
        art!,
        key: Key('game-art-$id'),
        fit: BoxFit.cover,
        errorBuilder: (context, error, stack) => fallback,
      );
    }
    return fallback;
  }
}
