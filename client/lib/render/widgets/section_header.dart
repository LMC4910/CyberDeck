/// Section-header widget (Wave 1 / C2). A small-caps, letter-spaced muted title
/// used to label a region of the deck — optionally with a trailing accent value
/// or count. It paints no card chrome of its own (headers sit between cards), but
/// follows the same type scale + tokens as [CardChrome]'s header row so the look
/// is consistent.
///
/// Data-driven: the title comes from `style.title` (or `config.title`); an
/// optional `style.trailing` / `config.trailing` renders a bright accent value at
/// the end of the row, and a thin accent rule underlines the title when
/// `style.rule == true`. Registered as `section.header`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a section header from a render context (the registry builder).
Widget buildSectionHeader(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final accent = resolveAccent(style);
  final title = (style['title'] as String? ?? node.config['title'] as String? ?? '')
      .trim();
  final trailing =
      (style['trailing'] as String? ?? node.config['trailing'] as String?)?.trim();
  final showRule = style['rule'] == true;

  return Padding(
    key: Key('section-header-${node.id}'),
    padding: const EdgeInsets.symmetric(vertical: DeckSpacing.xs),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title.toUpperCase(),
                key: Key('section-title-${node.id}'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DeckType.sectionLabel(fontSize: 12),
              ),
            ),
            if (trailing != null && trailing.isNotEmpty)
              Text(
                trailing,
                key: Key('section-trailing-${node.id}'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DeckType.mono(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: accent,
                ),
              ),
          ],
        ),
        if (showRule) ...[
          const SizedBox(height: DeckSpacing.xs),
          Container(
            height: 2,
            decoration: BoxDecoration(
              gradient: accentGradient(),
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        ],
      ],
    ),
  );
}
