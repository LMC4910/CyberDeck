/// Client state store (PROJ-181, 2C §7.2). Holds the latest value of each bound
/// state behind a per-id [ValueNotifier], so a state update repaints ONLY the
/// widgets listening to that id (targeted repaint, NFR-03). The renderer never
/// fabricates values — an id with no update yet reads null ("--" at the widget).
library;

import 'package:flutter/foundation.dart';

/// A live store of typed state values keyed by state id.
class ClientStateStore {
  final Map<String, ValueNotifier<Object?>> _notifiers = {};

  /// The listenable for a state id, created (null-valued) on first access so a
  /// widget can bind before the first update arrives.
  ValueListenable<Object?> listenable(String id) => _notifierFor(id);

  /// The current value of a state id (null if never set).
  Object? value(String id) => _notifiers[id]?.value;

  /// Applies a state update; only listeners of [id] are notified.
  void set(String id, Object? value) {
    _notifierFor(id).value = value;
  }

  /// Applies a batch of state deltas.
  void applyAll(Map<String, Object?> deltas) {
    deltas.forEach(set);
  }

  ValueNotifier<Object?> _notifierFor(String id) =>
      _notifiers.putIfAbsent(id, () => ValueNotifier<Object?>(null));

  /// Releases all notifiers.
  void dispose() {
    for (final n in _notifiers.values) {
      n.dispose();
    }
    _notifiers.clear();
  }
}
