/// Generic list card (Wave A composite): a SINGLE titled card that renders
/// `config.items` as rows of `[leading icon?] label … value [trailing icon?]`.
/// It is the one-node form of the recurring "Top Processes / Recent Activity /
/// Game Profiles / Detailed Info" panels — replacing per-row `stat.row` nodes.
///
/// Data-driven: `style.title`/`config.title` names the card; `config.items` is a
/// list of maps `{leading?, label, value?, trailing?, color?}` where `leading`/
/// `trailing` are deck-icon names and a per-row `color`/`theme` tints the value.
/// Empty/malformed items render safely. Owns its [CardChrome].
/// Registered as `list.card`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a generic list card from a render context (the registry builder).
Widget buildListCard(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final title = style['title'] as String? ?? node.config['title'] as String?;
  final configItems = _items(node.config['items']);
  // A bound LIST drives dynamic rows (e.g. live top-processes); a bound MAP drives
  // per-row `field` lookups (e.g. system.info {os,cpu,ram,storage}); otherwise the
  // authored config.items render. Mirrors how media.player binds one map state.
  final boundList = ctx.value is List ? _items(ctx.value) : null;
  final boundMap =
      ctx.value is Map ? (ctx.value! as Map).cast<String, dynamic>() : null;
  final items = boundList ?? configItems;

  return CardChrome(
    key: Key('list-card-${node.id}'),
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
              key: Key('list-empty-${node.id}'),
              style: DeckType.body(fontSize: 13, color: DeckColors.textSecondary),
            ),
          )
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
                  _ListRow(
                    id: node.id,
                    index: i,
                    item: items[i],
                    bound: boundMap,
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

class _ListRow extends StatelessWidget {
  const _ListRow({
    required this.id,
    required this.index,
    required this.item,
    required this.bound,
    required this.fallbackAccent,
  });

  final String id;
  final int index;
  final Map<String, dynamic> item;

  /// The bound map state (when the card binds one), for live `field` lookups.
  final Map<String, dynamic>? bound;
  final Color fallbackAccent;

  @override
  Widget build(BuildContext context) {
    final label = '${item['label'] ?? ''}';
    // A live value (from the bound map's `field`) wins over the authored literal.
    final field = item['field'] as String?;
    final live = (field != null && bound != null) ? bound![field] : null;
    final value = live ?? item['value'];
    final leading = item['leading'] as String?;
    final trailing = item['trailing'] as String?;
    final valueColor = resolveAccent(item, fallback: fallbackAccent);

    return Padding(
      key: Key('list-row-$id-$index'),
      padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
      child: Row(
        children: [
          if (leading != null) ...[
            Icon(deckIcon(leading), size: 18, color: valueColor),
            const SizedBox(width: DeckSpacing.md),
          ],
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: DeckType.body(fontSize: 13, color: DeckColors.textSecondary),
            ),
          ),
          if (value != null && '$value'.isNotEmpty) ...[
            const SizedBox(width: DeckSpacing.md),
            Text(
              '$value',
              key: Key('list-value-$id-$index'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: DeckType.mono(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: valueColor,
              ),
            ),
          ],
          if (trailing != null) ...[
            const SizedBox(width: DeckSpacing.sm),
            Icon(deckIcon(trailing), size: 16, color: DeckColors.textSecondary),
          ],
        ],
      ),
    );
  }
}
