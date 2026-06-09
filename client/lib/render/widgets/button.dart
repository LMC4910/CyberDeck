/// Button widget (PROJ-182): an action-trigger with an immediate pressed-state
/// (≤100ms) that emits its `tap` interaction slot (PROJ-187 maps the slot to an
/// action/flow/navigate target). Honours `valueRules` for conditional accent.
library;

import 'package:flutter/material.dart';

import '../registry.dart';
import 'widget_theme.dart';

/// Builds a button from a render context (the registry builder).
Widget buildButton(BuildContext context, WidgetRenderContext ctx) {
  final node = ctx.node;
  final label = node.appearance.style['label'] as String? ?? '';
  final matched = evaluateValueRules(ctx.value, node.appearance.valueRules);
  final accent = resolveAccent(matched ?? node.appearance.style);
  return _PressButton(
    key: Key('button-${node.id}'),
    id: node.id,
    label: label,
    accent: accent,
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
  });

  final String id;
  final String label;
  final Color accent;
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
    return GestureDetector(
      onTapDown: (_) => _setPressed(true), // pressed-state is synchronous (≤16ms)
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      onTap: widget.onTap, // emit the tap-slot interaction
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 80),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: widget.accent.withValues(alpha: _pressed ? 0.45 : 0.18),
            border: Border.all(color: widget.accent),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: _pressed
                ? Text(widget.label, key: Key('button-pressed-${widget.id}'))
                : Text(widget.label),
          ),
        ),
      ),
    );
  }
}
