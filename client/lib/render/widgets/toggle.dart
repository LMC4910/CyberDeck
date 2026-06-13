/// Toggle widget (PROJ-182): a switch bound to a boolean state. It REFLECTS the
/// bound state (host authority — it does not flip locally) and emits its `tap`
/// interaction slot on toggle; the mapped action performs the actual state change,
/// which flows back as a state update. Honours `valueRules` for the accent.
///
/// Repainted on the CyberDeck design system (Wave 1, C1): the [Switch] is themed
/// with the neon accent (glowing thumb when on, faint track when off) and the
/// optional label uses the heading face. The real [Switch] (keys + `tap` emit) is
/// preserved so it stays editable and testable.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Builds a toggle from a render context (the registry builder).
Widget buildToggle(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final on = ctx.value == true;
  final label = node.appearance.style['label'] as String? ?? '';
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? node.appearance.style);

  return Row(
    key: Key('toggle-${node.id}'),
    mainAxisSize: MainAxisSize.min,
    children: [
      Switch(
        key: Key('toggle-switch-${node.id}'),
        value: on,
        activeThumbColor: accent,
        activeTrackColor: accent.withValues(alpha: 0.4),
        inactiveThumbColor: DeckColors.textSecondary,
        inactiveTrackColor: Colors.white.withValues(alpha: 0.08),
        trackOutlineColor: WidgetStatePropertyAll(
          on ? accent.withValues(alpha: 0.6) : DeckColors.border,
        ),
        onChanged: (_) => ctx.emit('tap'),
      ),
      if (label.isNotEmpty) ...[
        const SizedBox(width: DeckSpacing.sm),
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: DeckType.heading(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: on ? DeckColors.textPrimary : DeckColors.textSecondary,
            ),
          ),
        ),
      ],
    ],
  );
}
