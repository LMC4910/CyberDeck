/// Smart-home room card (Wave A composite): a SINGLE card with a leading room
/// icon, the room name + a temperature readout, and an on/off toggle — the one-
/// node form of a Smart Home "room" tile (lights/climate per room).
///
/// Host-authoritative like every interactive widget: the toggle REFLECTS the
/// bound boolean state (it does not flip locally) and emits its `tap` slot, which
/// the host maps to the action. Data-driven: `style.name`/`config.name` (the room
/// name), `style.icon`, `style.temp`/`config.temp` (a temperature string such as
/// "22°C"), `style.color`/`theme` accent. Owns its [CardChrome].
/// Registered as `room.card`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a room card from a render context (the registry builder).
Widget buildRoomCard(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final config = node.config;
  final on = ctx.value == true;
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? style);

  final name = style['name'] as String? ??
      config['name'] as String? ??
      style['title'] as String? ??
      '';
  final iconName = style['icon'] as String?;
  final temp = style['temp'] as String? ?? config['temp'] as String?;

  return CardChrome(
    key: Key('room-card-${node.id}'),
    accent: accent,
    padding: const EdgeInsets.all(DeckSpacing.lg),
    child: Row(
      children: [
        Container(
          padding: const EdgeInsets.all(DeckSpacing.sm),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: on ? 0.20 : 0.10),
            borderRadius: BorderRadius.circular(DeckSpacing.radius),
          ),
          child: Icon(
            deckIcon(iconName, fallback: Icons.home_outlined),
            key: Key('room-icon-${node.id}'),
            color: on ? accent : DeckColors.textSecondary,
            size: 22,
          ),
        ),
        const SizedBox(width: DeckSpacing.md),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                key: Key('room-name-${node.id}'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DeckType.heading(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: DeckColors.textPrimary,
                ),
              ),
              if (temp != null && temp.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  temp,
                  key: Key('room-temp-${node.id}'),
                  style: DeckType.mono(
                    fontSize: 12,
                    color: DeckColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: DeckSpacing.sm),
        Switch(
          key: Key('room-toggle-${node.id}'),
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
      ],
    ),
  );
}
