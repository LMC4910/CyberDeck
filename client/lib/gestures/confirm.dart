/// Two-tap confirmation for destructive actions (PROJ-187 / IDP-03 / AC P1-AC-06).
/// A destructive action (flagged in the registry) requires a second tap within a
/// window to execute; the first tap arms a confirm affordance. Non-destructive
/// actions execute on the first tap.
library;

import 'package:flutter/material.dart';

/// The outcome of activating an action through the confirmer.
class ConfirmOutcome {
  const ConfirmOutcome({required this.execute, required this.armed});

  /// Execute the action now.
  final bool execute;

  /// The action is armed and awaiting a confirming second tap.
  final bool armed;
}

/// Gates destructive actions behind a 2-tap confirmation within [window].
class TwoTapConfirmer {
  TwoTapConfirmer({
    required this.isDestructive,
    this.window = const Duration(seconds: 3),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  /// Whether an action ref is destructive (wired from the registry).
  final bool Function(String ref) isDestructive;
  final Duration window;
  final DateTime Function() _clock;

  String? _armedRef;
  DateTime? _armedAt;

  /// The currently armed action ref, if any (for showing a confirm affordance).
  String? get armedRef => _armedRef;

  /// Activates [ref]: executes immediately if non-destructive, else arms on the
  /// first tap and executes on a second tap within the window.
  ConfirmOutcome activate(String ref) {
    if (!isDestructive(ref)) {
      return const ConfirmOutcome(execute: true, armed: false);
    }
    final now = _clock();
    if (_armedRef == ref &&
        _armedAt != null &&
        now.difference(_armedAt!) <= window) {
      reset();
      return const ConfirmOutcome(execute: true, armed: false);
    }
    _armedRef = ref;
    _armedAt = now;
    return const ConfirmOutcome(execute: false, armed: true);
  }

  /// Clears any armed state.
  void reset() {
    _armedRef = null;
    _armedAt = null;
  }
}

/// A small confirm banner shown while a destructive action is armed.
class ConfirmCard extends StatelessWidget {
  const ConfirmCard({super.key, required this.label, required this.onConfirm});

  final String label;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.redAccent.withValues(alpha: 0.15),
      child: ListTile(
        key: const Key('confirm-card'),
        leading: const Icon(Icons.warning_amber, color: Colors.redAccent),
        title: Text('Tap again to confirm: $label'),
        trailing: TextButton(
          onPressed: onConfirm,
          child: const Text('Confirm'),
        ),
      ),
    );
  }
}
