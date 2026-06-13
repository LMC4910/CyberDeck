/// Launcher-tile widget (Wave 1 / C2): a rounded app/shortcut tile — a square art
/// face above a caption label. The art is `Image.asset(style.asset)` when an
/// asset is given AND loads; otherwise it degrades to a PROCEDURAL gradient face
/// (the brand cyan→purple sweep tinted by the tile accent) carrying the named
/// icon (`style.icon`) or, failing that, a monogram of the label's first letter.
/// So a launcher always looks intentional even with no artwork.
///
/// Tapping emits the `tap` interaction slot (PROJ-187 maps it to an action/flow/
/// launch target) — the tile never launches anything locally. Data-driven: art /
/// icon / label / accent all read from `style` (+ `config.label`).
/// Registered as `launcher`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a launcher tile from a render context (the registry builder).
Widget buildLauncher(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final label = style['label'] as String? ?? node.config['label'] as String? ?? '';
  final asset = style['asset'] as String?;
  final iconName = style['icon'] as String?;

  return Material(
    type: MaterialType.transparency,
    child: InkWell(
      key: Key('launcher-${node.id}'),
      borderRadius: BorderRadius.circular(kCardRadius),
      onTap: () => ctx.emit('tap'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Expanded(
            child: AspectRatio(
              aspectRatio: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(kCardRadius),
                  border: Border.all(color: DeckColors.border),
                  boxShadow: neonGlow(accent, intensity: 0.6),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(kCardRadius),
                  child: _LauncherFace(
                    id: node.id,
                    asset: asset,
                    iconName: iconName,
                    label: label,
                    accent: accent,
                  ),
                ),
              ),
            ),
          ),
          if (label.isNotEmpty) ...[
            const SizedBox(height: DeckSpacing.sm),
            Text(
              label,
              key: Key('launcher-label-${node.id}'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: DeckType.body(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: DeckColors.textPrimary,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

/// The square art face: the asset image when it loads, else the procedural
/// gradient fallback (icon, or monogram of [label]).
class _LauncherFace extends StatelessWidget {
  const _LauncherFace({
    required this.id,
    required this.asset,
    required this.iconName,
    required this.label,
    required this.accent,
  });

  final String id;
  final String? asset;
  final String? iconName;
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final fallback = _proceduralFace(context);
    if (asset != null && asset!.isNotEmpty) {
      return Image.asset(
        asset!,
        key: Key('launcher-asset-$id'),
        fit: BoxFit.cover,
        // A missing/broken asset degrades to the procedural face, never an error.
        errorBuilder: (context, error, stack) => fallback,
      );
    }
    return fallback;
  }

  Widget _proceduralFace(BuildContext context) {
    // Tint the brand gradient toward this tile's accent so each tile reads
    // distinct while staying on-brand.
    final gradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color.alphaBlend(accent.withValues(alpha: 0.55), DeckColors.accentCyan),
        DeckColors.accentPurple,
      ],
    );
    return DecoratedBox(
      key: Key('launcher-fallback-$id'),
      decoration: BoxDecoration(gradient: gradient),
      child: Center(
        child: iconName != null
            ? Icon(
                deckIcon(iconName, fallback: Icons.rocket_launch_outlined),
                key: Key('launcher-icon-$id'),
                color: Colors.white,
                size: 32,
              )
            : Text(
                _monogram(label),
                key: Key('launcher-monogram-$id'),
                style: DeckType.display(
                  fontSize: 34,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }

  String _monogram(String label) {
    final t = label.trim();
    return t.isEmpty ? '?' : t.characters.first.toUpperCase();
  }
}
