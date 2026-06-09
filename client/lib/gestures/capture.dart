/// Gesture capture (PROJ-187, 2C §3 / IDP-04): wraps a widget and maps device
/// gestures to interaction-slot events (tap / doubleTap / longPress / pressDown /
/// pressUp / swipe*), with an immediate pressed-state overlay (≤100ms). The
/// consumer maps each slot to the widget's interaction target and dispatches it
/// (with 2-tap confirmation for destructive actions — see confirm.dart).
library;

import 'package:flutter/material.dart';

import 'slots.dart';

/// Wraps [child], emitting a slot id for each recognised gesture.
class GestureCapture extends StatefulWidget {
  const GestureCapture({
    super.key,
    required this.child,
    required this.onSlot,
    this.swipeVelocity = 300,
  });

  final Widget child;

  /// Receives the slot id of a recognised gesture.
  final void Function(String slot) onSlot;

  /// Minimum primary velocity (px/s) for a drag to count as a swipe.
  final double swipeVelocity;

  @override
  State<GestureCapture> createState() => _GestureCaptureState();
}

class _GestureCaptureState extends State<GestureCapture> {
  bool _pressed = false;

  void _press(bool v) {
    if (_pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    // Pressed-state + pressDown/pressUp ride raw pointer events (Listener) so they
    // fire immediately (≤16ms), unaffected by the gesture arena's tap-vs-drag
    // disambiguation — the discrete gestures (tap/double/long/swipe) come from the
    // GestureDetector.
    return Listener(
      onPointerDown: (_) {
        _press(true);
        widget.onSlot(Slots.pressDown);
      },
      onPointerUp: (_) {
        _press(false);
        widget.onSlot(Slots.pressUp);
      },
      onPointerCancel: (_) => _press(false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onSlot(Slots.tap),
        onDoubleTap: () => widget.onSlot(Slots.doubleTap),
        onLongPress: () => widget.onSlot(Slots.longPress),
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v.abs() >= widget.swipeVelocity) {
            widget.onSlot(v < 0 ? Slots.swipeLeft : Slots.swipeRight);
          }
        },
        onVerticalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v.abs() >= widget.swipeVelocity) {
            widget.onSlot(v < 0 ? Slots.swipeUp : Slots.swipeDown);
          }
        },
        child: Stack(
          children: [
            widget.child,
            if (_pressed)
              const Positioned.fill(
                child: IgnorePointer(
                  child: ColoredBox(
                    key: Key('gesture-pressed'),
                    color: Color(0x22FFFFFF),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
