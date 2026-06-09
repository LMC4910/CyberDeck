/// Interaction slots (PROJ-187, 2C §3). Each widget can map any gesture slot
/// independently to an action / flow / navigate target. The full slot set is
/// captured by the client in V1 (designer UI for some slots is Phase 2).
library;

import '../render/render.dart';

/// The interaction slot ids (the keys under a widget's `interaction`).
abstract final class Slots {
  static const String tap = 'tap';
  static const String doubleTap = 'doubleTap';
  static const String longPress = 'longPress';
  static const String pressDown = 'pressDown';
  static const String pressUp = 'pressUp';
  static const String dragValue = 'dragValue';
  static const String swipeLeft = 'swipeLeft';
  static const String swipeRight = 'swipeRight';
  static const String swipeUp = 'swipeUp';
  static const String swipeDown = 'swipeDown';

  static const List<String> all = [
    tap, doubleTap, longPress, pressDown, pressUp, dragValue,
    swipeLeft, swipeRight, swipeUp, swipeDown,
  ];
}

/// What a gesture slot does: an action / flow / navigate target (or none).
class InteractionTarget {
  const InteractionTarget({required this.kind, required this.ref, this.param});

  /// `action` | `flow` | `navigate` | `none`.
  final String kind;
  final String ref;
  final String? param;

  bool get isNone => kind == 'none' || ref.isEmpty;

  static InteractionTarget? fromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    return InteractionTarget(
      kind: m['target'] as String? ?? 'action',
      ref: m['ref'] as String? ?? '',
      param: m['param'] as String?,
    );
  }
}

/// The interaction target a widget maps to [slot], or null if unmapped.
InteractionTarget? interactionFor(WidgetNode node, String slot) =>
    InteractionTarget.fromMap(
        (node.interaction[slot] as Map?)?.cast<String, dynamic>());
