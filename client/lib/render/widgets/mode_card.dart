/// Performance-mode card (Wave A composite): a SINGLE card with a leading mode
/// icon, the mode name + a short description, and an ACTIVATE button that reads
/// "ACTIVE" when this mode is the selected one — the one-node form of a System
/// Control / Gaming Hub performance-mode tile (Balanced / Performance / Silent).
///
/// Host-authoritative: the active state REFLECTS the bound boolean (it does not
/// flip locally) and tapping emits the `tap` slot, which the host maps to the
/// mode-select action. Data-driven: `style.name`/`config.name`, `style.icon`,
/// `style.description`/`config.description`, `style.color`/`theme` accent.
/// Owns its [CardChrome]. Registered as `mode.card`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a performance-mode card from a render context (the registry builder).
Widget buildModeCard(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final config = node.config;
  final active = ctx.value == true;
  final accent = resolveAccent(style);

  final name = style['name'] as String? ??
      config['name'] as String? ??
      style['title'] as String? ??
      '';
  final iconName = style['icon'] as String?;
  final description =
      style['description'] as String? ?? config['description'] as String?;

  return CardChrome(
    key: Key('mode-card-${node.id}'),
    accent: accent,
    glow: active,
    borderColor: active ? accent.withValues(alpha: 0.6) : null,
    padding: const EdgeInsets.all(DeckSpacing.lg),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(DeckSpacing.sm),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: active ? 0.20 : 0.10),
                borderRadius: BorderRadius.circular(DeckSpacing.radius),
              ),
              child: Icon(
                deckIcon(iconName, fallback: Icons.bolt),
                key: Key('mode-icon-${node.id}'),
                color: active ? accent : DeckColors.textSecondary,
                size: 20,
              ),
            ),
            const SizedBox(width: DeckSpacing.md),
            Expanded(
              child: Text(
                name,
                key: Key('mode-name-${node.id}'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: DeckType.heading(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: DeckColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
        if (description != null && description.isNotEmpty) ...[
          const SizedBox(height: DeckSpacing.sm),
          Text(
            description,
            key: Key('mode-description-${node.id}'),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: DeckType.body(fontSize: 12, color: DeckColors.textSecondary),
          ),
        ],
        const SizedBox(height: DeckSpacing.md),
        _ActivateButton(id: node.id, active: active, accent: accent, onTap: () => ctx.emit('tap')),
      ],
    ),
  );
}

/// The ACTIVATE / ACTIVE pill: a filled accent button when this mode is active,
/// an outlined affordance otherwise. Emits its tap via [onTap].
class _ActivateButton extends StatelessWidget {
  const _ActivateButton({
    required this.id,
    required this.active,
    required this.accent,
    required this.onTap,
  });

  final String id;
  final bool active;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      label: active ? 'Active' : 'Activate',
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          key: Key('mode-activate-$id'),
          borderRadius: BorderRadius.circular(DeckSpacing.radius),
          onTap: onTap,
          child: Container(
            width: double.infinity,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(vertical: DeckSpacing.sm),
            decoration: BoxDecoration(
              gradient: active ? accentGradient() : null,
              color: active ? null : Colors.transparent,
              borderRadius: BorderRadius.circular(DeckSpacing.radius),
              border: Border.all(
                color: active ? Colors.transparent : accent.withValues(alpha: 0.6),
              ),
              boxShadow: active ? neonGlow(accent, intensity: 0.7) : const [],
            ),
            child: Text(
              active ? 'ACTIVE' : 'ACTIVATE',
              key: Key('mode-activate-label-$id'),
              style: DeckType.sectionLabel(
                fontSize: 11,
                color: active ? Colors.white : accent,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
