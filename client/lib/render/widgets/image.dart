/// Image / icon widget (PROJ-183): renders a static asset (`config.asset`) or a
/// named icon (`config.icon` / `style.icon`). Album-art / remote asset fetch is
/// Phase 2; V1 covers bundled assets + the built-in icon set.
library;

import 'package:flutter/material.dart';

import '../registry.dart';

/// Builds an image/icon from a render context (the registry builder).
Widget buildImage(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final key = Key('image-${node.id}');
  final asset = node.config['asset'] as String?;
  if (asset != null && asset.isNotEmpty) {
    return Image.asset(
      asset,
      key: key,
      errorBuilder: (context, error, stack) => const Icon(Icons.broken_image),
    );
  }
  final iconName =
      node.config['icon'] as String? ?? node.appearance.style['icon'] as String?;
  return Icon(_iconFor(iconName), key: key);
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
