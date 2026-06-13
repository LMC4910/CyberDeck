/// Panel widget (Wave 0 / granularity model): a PURE glassmorphic background —
/// a [CardChrome] fill + hairline border + soft accent glow, with an optional
/// small-caps `style.title`. It has NO content of its own; it is meant to be
/// placed FIRST (so the interpreter paints it BEHIND, per list-order Stack
/// layering) with small bare widgets (gauges, stat rows, sparklines, labels)
/// clustered ON TOP. This is how every "card" on the deck is composed — a panel
/// behind, editable bare widgets in front.
///
/// Data-driven: `style.title` (small-caps header), `style.accent`/`color`/`theme`
/// (glow tint), `style.glow:false` (drop the outer glow). Registered as `panel`.
library;

import 'package:flutter/material.dart';

import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a panel background from a render context (the registry builder).
Widget buildPanel(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  // `accent` is an alias for the colour key the granularity model uses; fall
  // back to the standard color/theme resolution.
  final accent = resolveAccent(
    style.containsKey('accent') ? {'color': style['accent'], ...style} : style,
  );
  final title = (style['title'] as String?)?.trim();
  final glow = style['glow'] != false;

  return CardChrome(
    key: Key('panel-${node.id}'),
    accent: accent,
    title: (title != null && title.isNotEmpty) ? title : null,
    glow: glow,
    padding: const EdgeInsets.all(DeckSpacing.md),
    // A panel is a pure background: it fills its placement and carries no body
    // content (the cluster of bare widgets layered on top supplies that).
    child: const SizedBox.expand(),
  );
}
