/// Notification-item widget (Wave 0 / granularity model): one alert/notification
/// row — a leading accent icon, a bold title + muted body, and a small muted
/// timestamp pinned to the trailing edge. Stack several on a [panel] to build a
/// notifications/alerts feed.
///
/// BARE by default (no card chrome) so it composes onto a panel; set
/// `style.card:true` to wrap it. Tapping emits the `tap` slot when an
/// interaction is wired (e.g. to open/dismiss). Data-driven: `config.title`/
/// `style.title`, `config.body`/`style.body`, `config.time`/`style.time`,
/// `style.icon`, `style.color`/`style.theme` accent (or `valueRules`).
/// Registered as `notification.item`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a notification item from a render context (the registry builder).
Widget buildNotificationItem(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final config = node.config;
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? style);

  final title = style['title'] as String? ?? config['title'] as String? ?? '';
  final body = style['body'] as String? ?? config['body'] as String? ?? '';
  final time = style['time'] as String? ?? config['time'] as String?;
  final iconName = style['icon'] as String? ?? config['icon'] as String?;

  Widget row = Material(
    type: MaterialType.transparency,
    child: InkWell(
      key: Key('notification-${node.id}'),
      borderRadius: BorderRadius.circular(DeckSpacing.radius),
      onTap: () => ctx.emit('tap'),
      child: Padding(
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
                key: Key('notification-icon-${node.id}'),
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
                      key: Key('notification-title-${node.id}'),
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
                      key: Key('notification-body-${node.id}'),
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
                key: Key('notification-time-${node.id}'),
                style: DeckType.mono(
                  fontSize: 10,
                  color: DeckColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );

  if (style['card'] == true) {
    row = CardChrome(
      accent: accent,
      padding: const EdgeInsets.symmetric(
        horizontal: DeckSpacing.md,
        vertical: DeckSpacing.xs,
      ),
      child: row,
    );
  }
  // Safety net: if dropped into a cell shorter than the row's intrinsic height,
  // clip to the cell instead of painting outside it. (Cosmetic overflow only —
  // the row itself is horizontal, so it never stripes.)
  return ClipRect(child: row);
}
