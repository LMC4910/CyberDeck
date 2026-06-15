/// Notification-list card (Wave A composite): a SINGLE titled feed card that
/// renders `config.items` as a column of notification rows — each a leading
/// accent icon chip, a bold title + muted body, and a trailing muted timestamp.
/// It replaces the old per-item `notification.item` nodes so the whole feed is
/// ONE editor entity.
///
/// Data-driven: `style.title`/`config.title` names the card; `config.items` is a
/// list of maps `{icon?, title, body?, time?, color?}` (a per-row `color`/`theme`
/// tints that row's icon). Empty/malformed items render safely. The card owns its
/// [CardChrome]. Registered as `notification.list`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a notification-list card from a render context (the registry builder).
Widget buildNotificationList(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final title = style['title'] as String? ?? node.config['title'] as String?;
  final items = _items(node.config['items']);

  return CardChrome(
    key: Key('notification-list-${node.id}'),
    accent: accent,
    title: title,
    padding: const EdgeInsets.symmetric(
      horizontal: DeckSpacing.lg,
      vertical: DeckSpacing.md,
    ),
    child: items.isEmpty
        ? Padding(
            padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
            child: Text(
              'No notifications',
              key: Key('notification-empty-${node.id}'),
              style: DeckType.body(fontSize: 13, color: DeckColors.textSecondary),
            ),
          )
        // A feed that exceeds the card scrolls within it (clipping at the edge)
        // rather than overflowing; shrink-wraps a short feed.
        : SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0)
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: DeckColors.border,
                    ),
                  _NotificationRow(
                    id: node.id,
                    index: i,
                    item: items[i],
                    fallbackAccent: accent,
                  ),
                ],
              ],
            ),
          ),
  );
}

/// Coerces `config.items` into a list of string-keyed maps; tolerant of nulls.
List<Map<String, dynamic>> _items(Object? raw) {
  if (raw is! List) return const [];
  return [
    for (final e in raw)
      if (e is Map) e.cast<String, dynamic>(),
  ];
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.id,
    required this.index,
    required this.item,
    required this.fallbackAccent,
  });

  final String id;
  final int index;
  final Map<String, dynamic> item;
  final Color fallbackAccent;

  @override
  Widget build(BuildContext context) {
    final title = '${item['title'] ?? ''}';
    final body = '${item['body'] ?? ''}';
    final time = item['time'] as String?;
    final iconName = item['icon'] as String?;
    final accent = resolveAccent(item, fallback: fallbackAccent);

    return Padding(
      key: Key('notification-row-$id-$index'),
      padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(DeckSpacing.sm),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(DeckSpacing.radius),
            ),
            child: Icon(
              deckIcon(iconName, fallback: Icons.notifications_none),
              color: accent,
              size: 18,
            ),
          ),
          const SizedBox(width: DeckSpacing.md),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title.isNotEmpty)
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DeckType.heading(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: DeckColors.textPrimary,
                    ),
                  ),
                if (body.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    body,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: DeckType.body(
                      fontSize: 12,
                      color: DeckColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (time != null && time.isNotEmpty) ...[
            const SizedBox(width: DeckSpacing.sm),
            Text(
              time,
              style: DeckType.mono(fontSize: 10, color: DeckColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
