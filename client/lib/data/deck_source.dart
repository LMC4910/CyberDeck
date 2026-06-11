/// The data seam between the UI and "where decks + state + actions come from".
///
/// A [DeckSource] is either the offline [MockDeckSource] (Demo Mode — seed decks +
/// generated telemetry, zero backend) or the live [EngineDeckSource] (a paired Go
/// engine). The app's screens depend only on this interface, so the same UI renders
/// and is testable with no engine.
library;

import 'package:flutter/foundation.dart';

import '../render/model.dart';

/// Connection state shown in the app's status badge.
enum ConnStatus { demo, connecting, connected, disconnected }

/// A deck the user can open (the list/home view).
@immutable
class DeckSummary {
  const DeckSummary({required this.id, required this.title, required this.subtitle});
  final String id;
  final String title;
  final String subtitle;
}

/// A single state value change pushed to the deck (telemetry / action result).
@immutable
class StateUpdate {
  const StateUpdate(this.id, this.value);
  final String id;
  final Object? value;
}

/// The result of invoking an action (drives user feedback).
@immutable
class ActionOutcome {
  const ActionOutcome({required this.ok, this.message = ''});
  const ActionOutcome.success([this.message = '']) : ok = true;
  const ActionOutcome.failure(this.message) : ok = false;
  final bool ok;
  final String message;
}

/// Supplies decks, live state, and action dispatch to the UI.
abstract class DeckSource {
  /// Human label for the source (e.g. "Demo Mode" or the engine id).
  String get label;

  /// Reactive connection status for the badge.
  ValueListenable<ConnStatus> get status;

  /// The decks available to open.
  List<DeckSummary> decks();

  /// The layout for a deck (the page the renderer builds from).
  LayoutPage layout(String deckId);

  /// A stream of state updates for the open deck: it emits the current snapshot on
  /// subscribe, then live changes. Filtered client-side by widget bindings.
  Stream<StateUpdate> states();

  /// Invokes an action (button tap / toggle / slider). Never throws — returns an
  /// [ActionOutcome] describing success/failure for user feedback.
  Future<ActionOutcome> invoke(String actionId, {Map<String, dynamic>? params});

  /// Persists an edited deck (Designer). Mock keeps it for the session; the engine
  /// source previews locally (engine-side persistence is a follow-up).
  void saveDeck(String deckId, LayoutPage page);

  /// Releases timers / streams / sockets.
  Future<void> dispose();
}
