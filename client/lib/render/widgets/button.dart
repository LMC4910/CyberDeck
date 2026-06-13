/// Button widget (PROJ-182): an action-trigger with an immediate pressed-state
/// (≤100ms) that emits its `tap` interaction slot (PROJ-187 maps the slot to an
/// action/flow/navigate target). Honours `valueRules` for conditional accent.
///
/// Repainted on the CyberDeck design system (Wave 1, C1): a glass neon button —
/// a gradient accent fill at low alpha, a 1px accent border, an optional leading
/// icon (`style.icon`/`config.icon`), the label in the heading face, and a
/// pressed-state that brightens the fill + blooms an outer glow. The pressed-state
/// scale + `tap` emit are preserved; all visuals derive from style/config + value.
library;

import 'package:flutter/material.dart';

import '../../theme/fonts.dart';
import '../../theme/surfaces.dart';
import '../../theme/tokens.dart';
import '../registry.dart';
import 'widget_theme.dart';

/// Maps the small built-in icon vocabulary used across widgets to [IconData].
IconData? buttonIconFor(String? name) {
  switch (name) {
    case 'play':
      return Icons.play_arrow;
    case 'pause':
      return Icons.pause;
    case 'next':
      return Icons.skip_next;
    case 'previous':
      return Icons.skip_previous;
    case 'power':
      return Icons.power_settings_new;
    case 'volume':
      return Icons.volume_up;
    case 'alert':
      return Icons.warning_amber;
    case 'check':
      return Icons.check;
    case 'close':
      return Icons.close;
    case 'add':
      return Icons.add;
    case 'settings':
      return Icons.settings;
    default:
      return null;
  }
}

/// Builds a button from a render context (the registry builder).
Widget buildButton(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final label = node.appearance.style['label'] as String? ?? '';
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? node.appearance.style);
  final icon = buttonIconFor(
    node.appearance.style['icon'] as String? ?? node.config['icon'] as String?,
  );
  return _PressButton(
    key: Key('button-${node.id}'),
    id: node.id,
    label: label,
    accent: accent,
    icon: icon,
    onTap: () => ctx.emit('tap'),
  );
}

class _PressButton extends StatefulWidget {
  const _PressButton({
    super.key,
    required this.id,
    required this.label,
    required this.accent,
    required this.onTap,
    this.icon,
  });

  final String id;
  final String label;
  final Color accent;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  State<_PressButton> createState() => _PressButtonState();
}

class _PressButtonState extends State<_PressButton> {
  bool _pressed = false;

  void _setPressed(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accent;
    final hasLabel = widget.label.isNotEmpty;
    return GestureDetector(
      onTapDown: (_) => _setPressed(true), // pressed-state is synchronous (≤16ms)
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: widget.onTap, // emit the tap-slot interaction
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 80),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                accent.withValues(alpha: _pressed ? 0.50 : 0.20),
                accent.withValues(alpha: _pressed ? 0.34 : 0.10),
              ],
            ),
            border: Border.all(
              color: accent.withValues(alpha: _pressed ? 1.0 : 0.7),
              width: 1,
            ),
            borderRadius: BorderRadius.circular(kCardRadius),
            boxShadow: neonGlow(accent, intensity: _pressed ? 1.4 : 0.6),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: DeckSpacing.md,
              vertical: DeckSpacing.sm,
            ),
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.icon != null) ...[
                    Icon(widget.icon, size: 18, color: DeckColors.textPrimary),
                    if (hasLabel) const SizedBox(width: DeckSpacing.sm),
                  ],
                  if (hasLabel)
                    Flexible(
                      child: Text(
                        widget.label,
                        key: _pressed ? Key('button-pressed-${widget.id}') : null,
                        textAlign: TextAlign.center,
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
            ),
          ),
        ),
      ),
    );
  }
}
