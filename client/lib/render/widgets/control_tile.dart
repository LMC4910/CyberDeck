/// Control-tile widget (Wave 0 / granularity model): a small SQUARE glass tile
/// with a centred icon above a tiny muted caption — the media/system controls
/// that flank the player in prototype.html (Pause / Previous / Lock / Terminal /
/// Next / Mute / File Explorer / Control Panel).
///
/// Tapping emits the `tap` interaction slot (PROJ-187 maps it to an action/flow),
/// with a synchronous pressed-state (brighter fill + bloom). It never performs
/// anything locally. Data-driven: `style.icon` (deck icon name), `style.label`/
/// `config.label` caption, `style.color`/`style.theme` accent. Registered as
/// `control.tile`.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'deck_icons.dart';
import 'widget_theme.dart';

/// Builds a control tile from a render context (the registry builder).
Widget buildControlTile(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final style = node.appearance.style;
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? style);
  final label =
      style['label'] as String? ?? node.config['label'] as String? ?? '';
  final iconName = style['icon'] as String? ?? node.config['icon'] as String?;
  // A control tile reflects an on/off-ish bound value (e.g. mute): when true the
  // tile reads "active" (accent fill); else neutral glass.
  final active = ctx.value == true;

  return _ControlTile(
    key: Key('control-tile-${node.id}'),
    id: node.id,
    label: label,
    icon: deckIcon(iconName, fallback: Icons.widgets_outlined),
    accent: accent,
    active: active,
    onTap: () => ctx.emit('tap'),
  );
}

class _ControlTile extends StatefulWidget {
  const _ControlTile({
    super.key,
    required this.id,
    required this.label,
    required this.icon,
    required this.accent,
    required this.active,
    required this.onTap,
  });

  final String id;
  final String label;
  final IconData icon;
  final Color accent;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_ControlTile> createState() => _ControlTileState();
}

class _ControlTileState extends State<_ControlTile> {
  bool _pressed = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accent;
    final highlight = _pressed || widget.active;
    final hasLabel = widget.label.isNotEmpty;

    return GestureDetector(
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: widget.onTap,
      child: AspectRatio(
        aspectRatio: 1,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          decoration: BoxDecoration(
            gradient: highlight
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      accent.withValues(alpha: _pressed ? 0.42 : 0.24),
                      accent.withValues(alpha: _pressed ? 0.26 : 0.12),
                    ],
                  )
                : cardGradient(),
            borderRadius: BorderRadius.circular(kCardRadius),
            border: Border.all(
              color: highlight
                  ? accent.withValues(alpha: _pressed ? 1.0 : 0.7)
                  : DeckColors.border,
              width: 1,
            ),
            boxShadow: highlight ? neonGlow(accent, intensity: _pressed ? 1.3 : 0.7) : const [],
          ),
          child: Padding(
            padding: const EdgeInsets.all(DeckSpacing.sm),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  widget.icon,
                  key: _pressed ? Key('control-tile-pressed-${widget.id}') : null,
                  color: highlight ? DeckColors.textPrimary : DeckColors.textSecondary,
                  size: 22,
                ),
                if (hasLabel) ...[
                  const SizedBox(height: DeckSpacing.xs),
                  Flexible(
                    child: Text(
                      widget.label,
                      key: Key('control-tile-label-${widget.id}'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: DeckType.body(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: DeckColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
