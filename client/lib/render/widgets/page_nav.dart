/// Page-nav widget (PROJ-186): a navigation control that switches the active page
/// (or profile). Tapping emits the `navigate` interaction slot carrying the
/// target (the node's `config.target` page/profile id) as the slot value; the
/// consumer (PROJ-187 / the deck screen) maps `navigate` to the page/profile
/// switch. Like every interactive widget it only EMITS — it does not navigate
/// locally, so navigation stays host-authoritative and consistent with the
/// layout document. Registered as `page.nav`.
library;

import 'package:flutter/material.dart';

import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a page-nav control from a render context (the registry builder).
Widget buildPageNav(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final accent = resolveAccent(node.appearance.style);
  final label = node.appearance.style['label'] as String? ?? '';
  final iconName = node.config['icon'] as String? ??
      node.appearance.style['icon'] as String?;
  // The navigation target (page or profile id). Emitted as the slot value so the
  // consumer knows where to go; null is still a valid "navigate" (e.g. next page).
  final target = node.config['target'] as String?;

  return Material(
    type: MaterialType.transparency,
    child: InkWell(
      key: Key('page-nav-${node.id}'),
      borderRadius: BorderRadius.circular(DeckSpacing.radius),
      onTap: () => ctx.emit('navigate', value: target),
      child: Container(
        constraints: const BoxConstraints(
          minWidth: DeckSpacing.minTouchTarget,
          minHeight: DeckSpacing.minTouchTarget,
        ),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          border: Border.all(color: accent),
          borderRadius: BorderRadius.circular(DeckSpacing.radius),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: DeckSpacing.md,
          vertical: DeckSpacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (iconName != null) ...[
              Icon(_navIcon(iconName), color: accent, size: 18),
              if (label.isNotEmpty) const SizedBox(width: DeckSpacing.sm),
            ],
            if (label.isNotEmpty)
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: DeckColors.textPrimary),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

IconData _navIcon(String name) {
  switch (name) {
    case 'next':
    case 'forward':
      return Icons.chevron_right;
    case 'previous':
    case 'back':
      return Icons.chevron_left;
    case 'home':
      return Icons.home_outlined;
    case 'grid':
    case 'pages':
      return Icons.grid_view_outlined;
    default:
      return Icons.navigation_outlined;
  }
}
