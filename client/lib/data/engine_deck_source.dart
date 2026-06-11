/// Live data source backed by a paired Go engine: wraps an [EngineConnection],
/// decoding the engine's `layout.snapshot` + `state.delta` frames and forwarding
/// interactions over the control channel. Designer edits are local-preview only
/// (engine-side op persistence is a follow-up).
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../net/connection_manager.dart';
import '../net/envelope.dart';
import '../render/model.dart';
import 'deck_source.dart';

class EngineDeckSource implements DeckSource {
  EngineDeckSource(this._conn) {
    _subs = [
      _conn.router.layout.listen(_onLayout, onError: (_) {}, onDone: _onDone),
      _conn.router.state.listen(_onState, onError: (_) {}),
    ];
  }

  final EngineConnection _conn;
  final _statusN = ValueNotifier<ConnStatus>(ConnStatus.connected);
  final _ctrl = StreamController<StateUpdate>.broadcast();
  final _readyC = Completer<void>();
  final Map<String, Object?> _snapshotState = {};
  LayoutPage _live = const LayoutPage(id: 'live');
  late final List<StreamSubscription<Envelope>> _subs;

  /// Completes when the first layout snapshot has arrived (the deck is renderable).
  Future<void> get ready => _readyC.future;

  @override
  String get label => _conn.engineUuid;

  @override
  ValueListenable<ConnStatus> get status => _statusN;

  @override
  List<DeckSummary> decks() =>
      [DeckSummary(id: 'live', title: 'Live Deck', subtitle: _conn.engineUuid)];

  @override
  LayoutPage layout(String deckId) => _live;

  @override
  Stream<StateUpdate> states() async* {
    for (final e in _snapshotState.entries) {
      yield StateUpdate(e.key, e.value);
    }
    yield* _ctrl.stream;
  }

  @override
  Future<ActionOutcome> invoke(String actionId, {Map<String, dynamic>? params}) async {
    try {
      final payload = utf8.encode(jsonEncode({
        'actionId': actionId,
        'params': ?params,
      }));
      await _conn.router
          .send(Channel.control, 'interaction', Uint8List.fromList(payload));
      return const ActionOutcome.success();
    } catch (e) {
      _statusN.value = ConnStatus.disconnected;
      return ActionOutcome.failure('$e');
    }
  }

  @override
  void saveDeck(String deckId, LayoutPage page) {
    _live = page; // local preview; engine-side persistence is a follow-up.
  }

  @override
  Future<void> dispose() async {
    for (final s in _subs) {
      await s.cancel();
    }
    _statusN.dispose();
    await _ctrl.close();
    await _conn.close();
  }

  void _onLayout(Envelope env) {
    if (env.type != 'layout.snapshot') return; // incremental ops: follow-up
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      _live = LayoutPage.fromJson(m);
      if (!_readyC.isCompleted) _readyC.complete();
    } catch (_) {}
  }

  void _onState(Envelope env) {
    try {
      final m = jsonDecode(utf8.decode(env.payload)) as Map<String, dynamic>;
      final id = m['id'] as String?;
      if (id != null) {
        _snapshotState[id] = m['value'];
        if (!_ctrl.isClosed) _ctrl.add(StateUpdate(id, m['value']));
      }
    } catch (_) {}
  }

  void _onDone() => _statusN.value = ConnStatus.disconnected;
}
