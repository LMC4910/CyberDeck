/// Image / icon widget (PROJ-183): renders a static asset (`config.asset`) or a
/// named icon (`config.icon` / `style.icon`). Album-art / remote asset fetch is
/// Phase 2; V1 covers bundled assets + the built-in icon set.
///
/// Repainted on the CyberDeck design system (Wave 1, C1): a named icon renders in
/// the resolved accent (cyan by default, or a `style.color`/`style.theme` accent)
/// centred in its cell; an asset image keeps its native pixels with a rounded clip
/// and a graceful broken-image fallback. The `image-<id>` key + icon mapping are
/// unchanged so it stays editable and testable.
library;

import 'package:flutter/material.dart';

import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds an image/icon from a render context (the registry builder).
Widget buildImage(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final key = Key('image-${node.id}');
  final asset = node.config['asset'] as String?;
  if (asset != null && asset.isNotEmpty) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(kCardRadius),
      child: Image.asset(
        asset,
        key: key,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stack) => const Center(
          child: Icon(Icons.broken_image, color: DeckColors.textSecondary),
        ),
      ),
    );
  }
  final iconName =
      node.config['icon'] as String? ?? node.appearance.style['icon'] as String?;
  final accent = resolveAccent(node.appearance.style);
  return Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Icon(_iconFor(iconName), key: key, color: accent),
    ),
  );
}

IconData _iconFor(String? name) {
  switch (name) {
    case 'play':
      return Icons.play_arrow;
    case 'pause':
      return Icons.pause;
    case 'next':
      return Icons.skip_next;
    case 'previous':
      return Icons.skip_previous;
    case 'power':
      return Icons.power_settings_new;
    case 'volume':
      return Icons.volume_up;
    case 'alert':
      return Icons.warning_amber;
    default:
      return Icons.image;
  }
}
