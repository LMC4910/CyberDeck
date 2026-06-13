/// Status-list widget (Wave 1 / C2): a titled glassmorphic card listing rows of
/// `leading icon + muted label + bright value`, separated by hairline dividers —
/// the canonical "system status / details" panel of a Control Center.
///
/// Data-driven: the rows come from `config.items`, a list of maps each with
/// `label`, `value`, and an optional `icon` (and optional per-row `theme`/`color`
/// for the value tint). The card title is `style.title` / `config.title`.
/// When a row's `value` names a `stateKey` instead, the host can keep it fresh by
/// rebinding — but the simple, fully host-authored form is a static list. The
/// card renders nothing dangerous on malformed items. Registered as `status.list`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a status list from a render context (the registry builder).
Widget buildStatusList(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final title = style['title'] as String? ?? node.config['title'] as String?;
  final items = _items(node.config['items']);

  return CardChrome(
    key: Key('status-list-${node.id}'),
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
              'No items',
              key: Key('status-empty-${node.id}'),
              style: DeckType.body(
                fontSize: 13,
                color: DeckColors.textSecondary,
              ),
            ),
          )
        : Column(
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
                _StatusRow(
                  id: node.id,
                  index: i,
                  item: items[i],
                  fallbackAccent: accent,
                ),
              ],
            ],
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

class _StatusRow extends StatelessWidget {
  const _StatusRow({
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
    final label = '${item['label'] ?? ''}';
    final value = '${item['value'] ?? '--'}';
    final iconName = item['icon'] as String?;
    // A per-row tint (color/theme) lets a row read as ok/warn/error; else the
    // bright value uses the card accent.
    final valueColor = resolveAccent(item, fallback: fallbackAccent);

    return Padding(
      key: Key('status-row-$id-$index'),
      padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
      child: Row(
        children: [
          if (iconName != null) ...[
            Icon(deckIcon(iconName), size: 18, color: DeckColors.textSecondary),
            const SizedBox(width: DeckSpacing.md),
          ],
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: DeckType.body(
                fontSize: 13,
                color: DeckColors.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: DeckSpacing.md),
          Text(
            value,
            key: Key('status-value-$id-$index'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DeckType.mono(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }
}
